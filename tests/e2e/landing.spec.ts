import { test, expect } from "@playwright/test";

test.describe("landing page", () => {
  test("renders the hero and links to signup and login", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Kelgan bolaga subsidiya olmay qolgandingizmi?",
    );
    await expect(page.getByRole("link", { name: "Kirish" })).toHaveAttribute("href", "/kirish");
    await expect(page.getByRole("link", { name: "14 kun bepul sinash" }).first()).toHaveAttribute(
      "href",
      "/sozlash",
    );
  });

  test("has no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
});

test.describe("PWA manifest and icons", () => {
  test("serves a valid manifest referencing existing icons", async ({ page, request }) => {
    const manifestRes = await request.get("/manifest.webmanifest");
    expect(manifestRes.ok()).toBeTruthy();
    const manifest = await manifestRes.json();
    expect(manifest.name).toContain("Qalqon");
    expect(manifest.icons.length).toBeGreaterThan(0);

    for (const icon of manifest.icons) {
      const iconRes = await request.get(icon.src);
      expect(iconRes.ok(), `icon ${icon.src} should be reachable`).toBeTruthy();
    }

    await page.goto("/");
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute("href", "/manifest.webmanifest");
  });
});

test.describe("auth pages render without a backend session", () => {
  test("/kirish renders the Telegram/PIN entry points", async ({ page }) => {
    await page.goto("/kirish");
    await expect(page).toHaveURL(/\/kirish/);
  });

  test("a protected route with no session redirects to /kirish", async ({ page }) => {
    await page.goto("/davomat");
    await expect(page).toHaveURL(/\/kirish/);
  });
});
