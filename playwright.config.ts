import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. Locally they reuse the dev server on :3000 (start it with
 * `npm run dev`). In CI the workflow builds the app and Playwright starts
 * `next start` against a local Supabase, with no real secrets.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isCI = Boolean(process.env.CI);
const port = new URL(baseURL).port || "3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // The checkout test and the shared demo account must not run twice at once.
  workers: 1,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: isCI ? `npm run start -- -p ${port}` : "npm run dev",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
