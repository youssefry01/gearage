import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
// Optional: run against a specific Chromium binary (used in restricted sandboxes where `playwright install` is blocked).
const executablePath = process.env.PW_CHROMIUM_PATH;
const args = process.env.PW_CHROMIUM_ARGS
  ? (JSON.parse(process.env.PW_CHROMIUM_ARGS) as string[])
  : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
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
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // The style guide is a dev tool; e2e on a production build opts in explicitly.
    env: { ENABLE_STYLEGUIDE: "1" },
  },
});
