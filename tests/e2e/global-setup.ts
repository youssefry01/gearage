import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect, type FullConfig } from "@playwright/test";
import { codeFrom, waitForEmail } from "./emails";
import { AUTH_STATE_FILE } from "./e2e-env";

/**
 * Runs once, after the web server is up and before any test.
 *
 *  1. WARM-UP. The first request to /login initializes Better Auth and the database connection pool; the first Server
 *     Action loads Argon2. On a cold production server that first request took about 3x longer than a warm one (HANDOFF
 *     section 11c) and made the first test that touched /login time out on its first attempt. A security test must not
 *     depend on retries, so the cold work is done here, and its duration is printed so a regression is visible.
 *  2. A SIGNED-IN SESSION for the specs that audit pages behind login (the accessibility and responsive matrices):
 *     one throw-away account is registered and verified through the real UI and its cookies are saved to disk.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const project = config.projects[0]!;
  const baseURL = project.use.baseURL!;
  const browser = await chromium.launch(project.use.launchOptions ?? {});
  const context = await browser.newContext({ baseURL });
  const consent = encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ts: 1 }));
  await context.addCookies([{ name: "consent", value: consent, url: baseURL }]);
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  const hydrated = (name: string) =>
    expect
      .poll(
        () =>
          page
            .getByRole("button", { name, exact: true })
            .evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps"))),
        { timeout: 120_000 },
      )
      .toBe(true);

  const t0 = performance.now();
  await page.goto("/en/login");
  const first = performance.now() - t0;
  const t1 = performance.now();
  await page.goto("/en/login");
  const second = performance.now() - t1;
  console.log(
    `e2e warm-up: first GET /en/login ${Math.round(first)} ms (cold), second ${Math.round(second)} ms (warm)`,
  );

  // Register and verify one account through the UI: exercises Better Auth, the database, Argon2, the outbox, cookies.
  const email = `matrix-${Date.now()}@example.test`;
  await page.goto("/en/register");
  await hydrated("Create account");
  await page.getByLabel("First name").fill("Matrix");
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mobile number").fill("01012345678");
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-91");
  await page.getByRole("checkbox", { name: /accept/i }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/en\/verify-email$/);
  await page.getByLabel("6-digit code").fill(codeFrom(await waitForEmail(email)));
  await page.waitForURL(/\/en\/account$/);

  await mkdir("tests/.auth", { recursive: true });
  await context.storageState({ path: AUTH_STATE_FILE });
  await writeFile(
    "tests/.auth/warmup.json",
    JSON.stringify({ firstLoginMs: Math.round(first), secondLoginMs: Math.round(second) }),
  );
  await browser.close();
}
