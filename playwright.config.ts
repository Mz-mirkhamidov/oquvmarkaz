import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3411;

// Some sandboxes pre-install a fixed Chromium revision at this exact path,
// older than what an updated @playwright/test expects, with no network
// access to download the matching one — fall back to it only when it's
// actually there; everywhere else (CI, a real dev machine) this is a no-op
// and the normal `playwright install`-managed browser is used.
const PINNED_CHROMIUM = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: existsSync(PINNED_CHROMIUM) ? { executablePath: PINNED_CHROMIUM } : {},
      },
    },
  ],
  webServer: {
    // A production build, not `next dev` — the service worker (public/sw.js)
    // only registers in production, and that's what these tests exercise.
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
