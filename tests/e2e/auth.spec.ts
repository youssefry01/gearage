import { expect, test, type Page } from "@playwright/test";
import { codeFrom, emailsFor, resetLinkFrom, waitForEmail } from "./emails";
import { whenHydrated } from "./helpers";

// Throw-away addresses and a password that is long, unusual and not in any breach list (the breach check is skipped in
// test mode, but the shape rules still apply).
const PASSWORD = "correct-horse-battery-staple-91";
let counter = 0;
const unique = (label: string) => `${label}-${Date.now()}-${counter++}@example.test`;

async function fillRegistration(page: Page, email: string, password = PASSWORD) {
  await page.goto("/en/register");
  await whenHydrated(page.getByRole("button", { name: "Create account" }));
  await page.getByLabel("First name").fill("Mona");
  await page.getByLabel("Last name").fill("Hassan");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mobile number").fill("010 1234 5678");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("checkbox", { name: /accept/i }).check();
}

async function registerAndVerify(page: Page, email: string) {
  await fillRegistration(page, email);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/verify-email\?email=/);
  const code = codeFrom(await waitForEmail(email));
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page).toHaveURL(/\/en\/account$/);
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/en/login");
  await whenHydrated(page.getByRole("button", { name: "Sign in", exact: true }));
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test.describe("authentication", () => {
  test("register, verify with the emailed code, land signed in, sign out and in again", async ({
    page,
  }) => {
    const email = unique("happy");
    await registerAndVerify(page, email);
    await expect(page.getByTestId("account-hello")).toContainText("Mona");

    await page.getByTestId("logout").click();
    await expect(page).toHaveURL(/\/en$/);
    await page.goto("/en/account");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Faccount/);

    await signIn(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/en\/account$/);
  });

  test("the session cookie is HttpOnly, SameSite=Lax, not readable by scripts, and Secure only over https", async ({
    page,
    context,
  }) => {
    await registerAndVerify(page, unique("cookie"));
    const cookie = (await context.cookies()).find((c) => c.name.endsWith("auth.session_token"));
    expect(cookie, "session cookie").toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe("Lax");
    expect(cookie!.path).toBe("/");
    expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000 + 6 * 86_400); // 7-day session
    // These tests run on http://localhost, so Secure is off here; production (https APP_URL) turns it on.
    expect(cookie!.secure).toBe(false);
    expect(await page.evaluate(() => document.cookie)).not.toContain("session_token");
  });

  test("a wrong password gives the same message for a real and an unknown address", async ({
    page,
  }) => {
    const email = unique("known");
    await registerAndVerify(page, email);
    await page.getByTestId("logout").click();

    const alert = page.locator("form [role=alert]").first();
    await signIn(page, email, "not-the-password-0000");
    await expect(alert).toHaveText("Incorrect email or password.");
    await signIn(page, unique("ghost"), "not-the-password-0000");
    await expect(alert).toHaveText("Incorrect email or password."); // identical for an address with no account
  });

  test("registering an address that already has an account looks identical, and the owner is told by email", async ({
    page,
  }) => {
    const email = unique("dup");
    await registerAndVerify(page, email);
    await page.context().clearCookies();

    await fillRegistration(page, email, "another-long-passphrase-777");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/verify-email\?email=/); // same destination as a new account
    await expect
      .poll(async () =>
        (await emailsFor(email)).some((m) => /already have an account/i.test(m.text)),
      )
      .toBe(true);
    // No new verification code was issued for the existing account.
    expect((await emailsFor(email)).filter((m) => /6-digit|code/i.test(m.subject))).toHaveLength(1);
  });

  test("a wrong code is refused, then the right one works", async ({ page }) => {
    const email = unique("code");
    await fillRegistration(page, email);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/verify-email/);
    const code = codeFrom(await waitForEmail(email));
    const wrong = code === "000000" ? "111111" : "000000";
    await whenHydrated(page.getByRole("button", { name: "Verify email" }));
    await page.getByLabel("6-digit code").fill(wrong);
    await page.getByRole("button", { name: "Verify email" }).click();
    await expect(page.locator("form [role=alert]").first()).toContainText("isn't right");
    await page.getByLabel("6-digit code").fill(code);
    await page.getByRole("button", { name: "Verify email" }).click();
    await expect(page).toHaveURL(/\/en\/account$/);
  });

  test("signing in to an unverified account with the right password sends you to verification", async ({
    page,
  }) => {
    const email = unique("unverified");
    await fillRegistration(page, email);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/verify-email/);
    await waitForEmail(email, 1);
    await signIn(page, email, PASSWORD);
    await expect(page).toHaveURL(/verify-email/);
    await waitForEmail(email, 2); // a fresh code was sent
  });

  test("five wrong passwords lock the account for a while, even against the right password", async ({
    page,
  }) => {
    const email = unique("lock");
    await registerAndVerify(page, email);
    await page.getByTestId("logout").click();
    for (let i = 0; i < 5; i++) {
      await signIn(page, email, `wrong-password-${i}-xxxxxxxx`);
      await expect(page.locator("form [role=alert]").first()).toContainText(
        "Incorrect email or password.",
      );
    }
    await signIn(page, email, PASSWORD);
    await expect(page.locator("form [role=alert]").first()).toContainText(
      "Too many failed attempts",
    );
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("an unknown address is locked out exactly like a real one", async ({ page }) => {
    const ghost = unique("ghostlock");
    for (let i = 0; i < 5; i++) {
      await signIn(page, ghost, `wrong-password-${i}-xxxxxxxx`);
      await expect(page.locator("form [role=alert]").first()).toContainText(
        "Incorrect email or password.",
      );
    }
    await signIn(page, ghost, "wrong-password-6-xxxxxxxx");
    await expect(page.locator("form [role=alert]").first()).toContainText(
      "Too many failed attempts",
    );
  });

  test("the next parameter only ever leads to a path on this site", async ({ page }) => {
    const email = unique("redirect");
    await registerAndVerify(page, email);
    await page.getByTestId("logout").click();
    await page.goto("/en/login?next=//evil.example/steal");
    await whenHydrated(page.getByRole("button", { name: "Sign in", exact: true }));
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/localhost.*\/en\/account$/);
  });

  test("a form post from another origin is rejected and sets no session", async ({
    page,
    request,
  }) => {
    const email = unique("csrf");
    await registerAndVerify(page, email);
    await page.getByTestId("logout").click();
    await page.goto("/en/login");
    await whenHydrated(page.getByRole("button", { name: "Sign in", exact: true }));

    // Capture a genuine Server Action request (its Next-Action id), then replay it as a different site would.
    const captured = page.waitForRequest(
      (r) => r.method() === "POST" && !!r.headers()["next-action"],
    );
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password-csrf-xxxx");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const original = await captured;
    await expect(page.locator("form [role=alert]").first()).toBeVisible();

    const replay = await request.post(original.url(), {
      headers: {
        "next-action": original.headers()["next-action"]!,
        "content-type": "text/plain;charset=UTF-8",
        origin: "https://evil.example",
      },
      data: JSON.stringify([{ email, password: PASSWORD }]),
    });
    expect(replay.status()).toBeGreaterThanOrEqual(400);
    expect(replay.headers()["set-cookie"] ?? "").not.toContain("session_token");
  });

  test("the strength meter reacts as a password is typed", async ({ page }) => {
    await page.goto("/en/register");
    await whenHydrated(page.getByRole("button", { name: "Create account" }));
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("password1234");
    await expect(page.getByTestId("strength-meter")).toContainText(/Very weak|Weak/);
    await password.fill("tuba-mango-zephyr-quartz-81");
    await expect(page.getByTestId("strength-meter")).toContainText(/Good|Strong/);
  });

  test("the Arabic register page is right-to-left and fully translated", async ({ page }) => {
    await page.goto("/ar/register");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("أنشئ حسابك");
    await page.getByRole("button", { name: "إنشاء الحساب" }).click();
    await expect(page.locator("form [role=alert]").first()).toContainText("هذا الحقل مطلوب");
  });

  test.describe("forgot and reset password", () => {
    const NEW = "my-new-passphrase-with-words-55";

    async function requestReset(page: Page, email: string) {
      await page.goto("/en/forgot-password");
      await whenHydrated(page.getByRole("button", { name: "Send reset link" }));
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByRole("button", { name: "Send reset link" }).click();
    }

    test("the same confirmation appears for a real and an unknown address", async ({ page }) => {
      const email = unique("forgot");
      await registerAndVerify(page, email);
      await page.getByTestId("logout").click();
      await requestReset(page, email);
      const real = await page.getByTestId("forgot-sent").textContent();
      await requestReset(page, unique("nobody"));
      await expect(page.getByTestId("forgot-sent")).toHaveText(real!);
      await waitForEmail(email, 2); // verification code + reset link
      expect(await emailsFor("nobody@example.test")).toHaveLength(0);
    });

    test("the emailed link carries the token in the fragment, opening it changes nothing, submitting sets the new password once", async ({
      page,
    }) => {
      const email = unique("reset");
      await registerAndVerify(page, email);
      await page.getByTestId("logout").click();
      await requestReset(page, email);
      await expect.poll(async () => (await emailsFor(email)).length).toBe(2);
      const link = resetLinkFrom((await emailsFor(email))[1]!);
      expect(new URL(link).search).toBe(""); // no query string
      expect(new URL(link).hash).toMatch(/^#token=/);

      // Opening the link (as an email scanner or a curious click would) must not use the token up.
      await page.goto(link);
      await page.goto(link);
      await whenHydrated(page.getByRole("button", { name: "Save new password" }));
      await page.getByLabel("New password", { exact: true }).fill("short");
      await page.getByRole("button", { name: "Save new password" }).click();
      await expect(page.locator("form [role=alert]").first()).toContainText("at least 12");
      await page.getByLabel("New password", { exact: true }).fill(NEW);
      await page.getByRole("button", { name: "Save new password" }).click();
      await expect(page).toHaveURL(/\/en\/login\?reset=1$/);
      await expect(page.getByTestId("reset-done")).toBeVisible();

      await signIn(page, email, PASSWORD);
      await expect(page.locator("form [role=alert]").first()).toHaveText(
        "Incorrect email or password.",
      );
      await signIn(page, email, NEW);
      await expect(page).toHaveURL(/\/en\/account$/);

      // The link is single-use.
      await page.getByTestId("logout").click();
      await page.goto(link);
      await whenHydrated(page.getByRole("button", { name: "Save new password" }));
      await page
        .getByLabel("New password", { exact: true })
        .fill("a-third-passphrase-with-words-9");
      await page.getByRole("button", { name: "Save new password" }).click();
      await expect(page.locator("form [role=alert]").first()).toContainText(
        "invalid or has expired",
      );
    });

    test("a reset signs out every other session and a reset page without a token explains itself", async ({
      page,
      browser,
    }) => {
      const email = unique("revoke");
      await registerAndVerify(page, email);
      const other = await browser.newContext();
      const otherPage = await other.newPage();
      await otherPage.goto("/en/login");
      await whenHydrated(otherPage.getByRole("button", { name: "Sign in", exact: true }));
      await signIn(otherPage, email, PASSWORD);
      await expect(otherPage).toHaveURL(/\/en\/account$/);

      await requestReset(page, email);
      await expect.poll(async () => (await emailsFor(email)).length).toBe(2);
      await page.goto(resetLinkFrom((await emailsFor(email))[1]!));
      await whenHydrated(page.getByRole("button", { name: "Save new password" }));
      await page.getByLabel("New password", { exact: true }).fill(NEW);
      await page.getByRole("button", { name: "Save new password" }).click();
      await expect(page).toHaveURL(/reset=1/);

      await otherPage.goto("/en/account");
      await expect(otherPage).toHaveURL(/\/en\/login/);
      await other.close();

      await page.goto("/en/reset-password");
      await expect(page.locator("[role=alert]").filter({ hasText: "incomplete" })).toBeVisible();
    });
  });
});
