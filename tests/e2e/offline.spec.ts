import { test, expect, type Page } from "@playwright/test";

// Formalizes the manual verification done in M4: the service worker
// registers on a production build, activates, and the offline fallback
// (public/sw.js's OFFLINE_URL) serves when a route isn't cached.

/**
 * `serviceWorker.ready` resolves once a worker is active for this scope,
 * but sw.js's `clients.claim()` (in its 'activate' handler) can still be
 * mid-flight — reloading right then races Chromium into aborting the
 * navigation ("net::ERR_ABORTED"). Waiting for `controller` to actually be
 * set confirms claim() has landed for *this* page before reloading it.
 */
async function waitForControl(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

test.describe("service worker", () => {
  test("registers and reaches the active state", async ({ page }) => {
    await page.goto("/");
    const state = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const worker = reg.active ?? reg.waiting ?? reg.installing;
      if (!worker) return "none";
      if (worker.state === "activated") return worker.state;
      return new Promise<string>((resolve) => {
        worker.addEventListener("statechange", () => {
          if (worker.state === "activated") resolve(worker.state);
        });
      });
    });
    expect(state).toBe("activated");
  });

  test("serves the offline fallback page when navigating while offline", async ({ page, context }) => {
    // A worker only controls navigations *after* it's taken over — the
    // very first load in a fresh context is never SW-controlled, so an
    // online reload first is required for the SW to intercept what follows.
    await page.goto("/");
    await waitForControl(page);
    await page.reload();
    await waitForControl(page); // reload creates a new document/client — confirm it's controlled too

    await context.setOffline(true);
    await page.goto("/bolalar"); // not previously visited, so nothing's cached for it
    await expect(page.getByText("Bu sahifa hali yuklanmagan")).toBeVisible();
    await context.setOffline(false);
  });

  test("still serves a previously visited page while offline", async ({ page, context }) => {
    // The first load of any session is never SW-controlled (a worker only
    // takes over the *next* navigation, even with clients.claim()), so "/"
    // isn't actually cached yet — an online reload is what populates it.
    await page.goto("/");
    await waitForControl(page);
    await page.reload();
    await waitForControl(page); // reload creates a new document/client — confirm it's controlled too
    await page.waitForTimeout(500); // staleWhileRevalidate's cache.put runs after the response resolves

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Kelgan bolaga subsidiya olmay qolgandingizmi?",
    );
    await context.setOffline(false);
  });
});
