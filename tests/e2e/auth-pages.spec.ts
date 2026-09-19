import { test, expect } from "@playwright/test";

// These run without any env vars (CI has none by design), so they stop at
// the point where a request would need a database. What they do cover is
// the part that broke in production before: a sign-in route that renders
// but offers no working way in.

test.describe("/kirish", () => {
  test("offers all three ways in", async ({ page }) => {
    await page.goto("/kirish");
    await expect(page.getByRole("link", { name: "Pochta va parol bilan" })).toHaveAttribute(
      "href",
      "/kirish/email",
    );
    await expect(page.getByRole("link", { name: "Tarbiyachiman" })).toHaveAttribute(
      "href",
      "/kirish/pin",
    );
  });
});

test.describe("/kirish/email", () => {
  test("shows the sign-in form and switches to registration", async ({ page }) => {
    await page.goto("/kirish/email");
    await page.waitForLoadState("networkidle");

    const form = page.locator("form");
    await expect(form.getByLabel("Pochta")).toBeVisible();
    await expect(form.getByLabel("Parol")).toBeVisible();
    // Only registration asks for a name.
    await expect(form.getByLabel("Ismingiz")).toHaveCount(0);
    await expect(form.locator('button[type="submit"]')).toHaveText("Kirish");

    await page.locator('button[type="button"]', { hasText: "Ro'yxatdan o'tish" }).click();
    await expect(form.getByLabel("Ismingiz")).toBeVisible();
    await expect(form.locator('button[type="submit"]')).toHaveText("Ro'yxatdan o'tish");
  });

  test("rejects a short password before it ever reaches the server", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/auth/")) requests.push(req.url());
    });

    await page.goto("/kirish/email");
    // The tab is a React onClick, so the click has to land after
    // hydration — without this the page is still server HTML and the
    // click silently does nothing.
    await page.waitForLoadState("networkidle");
    await page.locator('button[type="button"]', { hasText: "Ro'yxatdan o'tish" }).click();
    await page.getByLabel("Ismingiz").fill("Test Rahbar");
    await page.getByLabel("Pochta").fill("rahbar@misol.uz");
    await page.getByLabel("Parol").fill("123");
    await page.locator('form button[type="submit"]').click();

    await expect(page.locator('form [role="alert"]')).toContainText("kamida 8 ta belgi");
    expect(requests).toEqual([]);
  });

  test("has no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/kirish/email");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
});
