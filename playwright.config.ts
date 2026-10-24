import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
// Optional: run against a specific Chromium binary (used in restricted sandboxes where `playwright install` is blocked).
const executablePath = process.env.PW_CHROMIUM_PATH;
const args = process.env.PW_CHROMIUM_ARGS
  ? (JSON.parse(process.env.PW_CHROMIUM_ARGS) as string[])
  : undefined;

// `next dev` compiles each route on its first visit, which can take many seconds on a cold start, so dev runs get
// longer timeouts. Production runs (CI, E2E_PROD) keep the strict ones.
const strict = !!process.env.CI || !!process.env.E2E_PROD;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: strict ? 30_000 : 90_000,
  expect: { timeout: strict ? 5_000 : 20_000 },
  fullyParallel: true,
  // `next dev` compiles routes on demand, so many parallel workers make a cold local run slower and flakier, not
  // faster. Local default is 2 (4 against a production build); override with PW_WORKERS. CI keeps Playwright's default.
  workers: process.env.PW_WORKERS
    ? Number(process.env.PW_WORKERS)
    : process.env.CI
      ? undefined
      : process.env.E2E_PROD
        ? 4
        : 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${port}`, trace: "on-first-retry" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: executablePath ? { executablePath, args } : {},
      },
    },
  ],
  webServer: {
    command: process.env.CI || process.env.E2E_PROD ? "npm run start" : "npm run dev",
    url: `http://localhost:${port}/api/health`,
    // Never silently attach to whatever is already on the port: a stale or different server gave false
    // "connection refused" and wrong-app failures. Opt in explicitly with E2E_REUSE_SERVER=1 (scripts/e2e-preflight.mjs
    // fails fast with a clear message when the port is busy and this is not set).
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 120_000,
    // The style guide is a dev tool; e2e on a production build opts in explicitly.
    env: { ENABLE_STYLEGUIDE: "1" },
  },
});
