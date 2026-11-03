import { defineConfig, devices } from "@playwright/test";
import { E2E_AUTH_SECRET, E2E_PASSWORD_PEPPER } from "./tests/e2e/e2e-env";

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
  // Warms the cold server and saves one signed-in session for the page matrices (tests/e2e/global-setup.ts).
  globalSetup: "./tests/e2e/global-setup.ts",
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
    env: {
      ENABLE_STYLEGUIDE: "1",
      // A test run can never send real email or touch Upstash, whatever .env contains (TEST_MODE is enforced in code;
      // the blanks also stop Next from loading the real values from .env, which never overrides a variable that is set).
      TEST_MODE: "1",
      EMAIL_PROVIDER: "log",
      EMAIL_LOG_DIR: "tests/.emails",
      BREVO_API_KEY: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      // Parallel workers share one IP, so scale every rate limit up (the real values are covered by DB tests).
      RATE_LIMIT_SCALE: "50",
      // Throw-away secrets: e2e must not depend on, or use, the developer's real ones.
      AUTH_SECRET: E2E_AUTH_SECRET,
      PASSWORD_PEPPER: E2E_PASSWORD_PEPPER,
    },
  },
});
