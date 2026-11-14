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
 *     The warm-up also performs one real sign-out and sign-in (and one sign-in for an unknown address), so Better Auth's
 *     sign-in path, Argon2 verification and the session hooks are warm too.
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

  // Sign out and sign in again for real. Registration warmed Argon2 HASHING; a sign-in is a different path (Better Auth's
  // sign-in, Argon2 VERIFY, the session create hooks with the device label, the lockout bookkeeping). The first test that
  // touched it after a cold start failed once on the first repeat (HANDOFF issue 108), so it is exercised here, twice:
  // an address with no account (the dummy-hash path) and the real credentials.
  const loginPassword = "correct-horse-battery-staple-91";
  const signIn = async (address: string, password: string) => {
    await page.goto("/en/login");
    await hydrated("Sign in");
    await page.getByLabel("Email", { exact: true }).fill(address);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  };
  await page.getByTestId("logout").click();
  await page.waitForURL(/\/en$/);
  const warmT = performance.now();
  await signIn(`ghost-${Date.now()}@example.test`, "not-the-password-0000");
  await page.locator("form [role=alert]").first().waitFor();
  await signIn(email, loginPassword);
  await page.waitForURL(/\/en\/account$/);
  const signInMs = performance.now() - warmT;
  // The signed-in pages the specs hit first, so their first render is not the cold one.
  for (const path of ["/en/account/profile", "/en/account/security"]) await page.goto(path);
  console.log(
    `e2e warm-up: wrong-address sign-in plus real sign-in took ${Math.round(signInMs)} ms`,
  );

  await mkdir("tests/.auth", { recursive: true });
  await context.storageState({ path: AUTH_STATE_FILE });
  await writeFile(
    "tests/.auth/warmup.json",
    JSON.stringify({
      firstLoginMs: Math.round(first),
      secondLoginMs: Math.round(second),
      signInMs: Math.round(signInMs),
    }),
  );
  await browser.close();
}
