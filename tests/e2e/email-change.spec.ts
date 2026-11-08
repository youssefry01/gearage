import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { codeFrom, emailsFor, waitForEmail } from "./emails";
import { whenHydrated } from "./helpers";

// Email change (M5b-2a, ADR 0026). Each test registers its own throw-away account.
const PASSWORD = "correct-horse-battery-staple-91";
const FIREFOX_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0";
let counter = 0;
const unique = (label: string) => `${label}-${Date.now()}-${counter++}@example.test`;
const CONSENT = encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ts: 1 }));

async function registerAndVerify(page: Page, email: string) {
  await page.goto("/en/register");
  await whenHydrated(page.getByRole("button", { name: "Create account" }));
  await page.getByLabel("First name").fill("Mona");
  await page.getByLabel("Last name").fill("Hassan");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mobile number").fill("010 1234 5678");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox", { name: /accept/i }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/verify-email$/);
  const code = codeFrom(await waitForEmail(email));
  await whenHydrated(page.getByRole("button", { name: "Verify email" }));
  await page.getByLabel("6-digit code").fill(code);
  await expect(page).toHaveURL(/\/en\/account$/);
}

async function secondBrowser(browser: Browser, baseURL: string, email: string) {
  const context = await browser.newContext({ baseURL, userAgent: FIREFOX_MAC });
  await context.addCookies([{ name: "consent", value: CONSENT, url: baseURL }]);
  const page = await context.newPage();
  await page.goto("/en/login");
  await whenHydrated(page.getByRole("button", { name: "Sign in", exact: true }));
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/account$/);
  return { context, page };
}

async function startChange(page: Page, newEmail: string, password = PASSWORD) {
  await page.goto("/en/account/email");
  await whenHydrated(page.getByRole("button", { name: "Send code" }));
  await page.getByLabel("New email address").fill(newEmail);
  await page.getByLabel("Your password").fill(password);
  await page.getByRole("button", { name: "Send code" }).click();
}

/** The code email is the one with a 6-digit code; the notice has none. */
async function codeFor(newEmail: string): Promise<string> {
  return codeFrom(await waitForEmail(newEmail));
}

const cancelLinkFrom = (text: string) => {
  const m = /https?:\/\/[^\s"<>]+\/email-change\/cancel#token=[^\s"<>]+/.exec(text);
  if (!m) throw new Error("no cancel link");
  return m[0];
};

test.describe("email change", () => {
  test("needs the password, mails the new and the old address, signs out other devices, and the new address signs in", async ({
    page,
    browser,
    baseURL,
  }) => {
    const oldEmail = unique("old");
    const newEmail = unique("new");
    await registerAndVerify(page, oldEmail);
    const other = await secondBrowser(browser, baseURL!, oldEmail);

    // A wrong password is refused and nothing is sent.
    await startChange(page, newEmail, "not-my-password-0000");
    await expect(page.getByText("That isn't your current password.")).toBeVisible();
    expect(await emailsFor(newEmail)).toHaveLength(0);

    // The right one moves to the code step.
    await page.getByLabel("Your password").fill(PASSWORD);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByTestId("email-code-form")).toBeVisible();
    // The button that had focus is gone: focus moved to the new step's heading.
    await expect(page.getByRole("heading", { name: "Enter the code" })).toBeFocused();
    await expect(page.getByTestId("email-code-form")).toContainText(/n\*\*\*@example\.test/);
    await expect(page.getByTestId("email-attempts-left")).toHaveText("5 attempts left");

    // The OLD address is told, with a cancel link and the device; the NEW one gets the code.
    const notice = await waitForEmail(oldEmail, 2); // 1 = verification code at sign-up
    expect(notice.subject).toMatch(/email change was requested/i);
    expect(notice.text).toMatch(/Chrome on (Windows|macOS|Linux)/);
    expect(cancelLinkFrom(notice.text)).toMatch(/#token=/);
    const code = await codeFor(newEmail);

    // The page survives a reload (the pending request lives on the server) and a wrong code is counted.
    await page.reload();
    await whenHydrated(page.getByRole("button", { name: "Confirm new address" }));
    const wrong = code === "000000" ? "111111" : "000000";
    await page.getByLabel("6-digit code").fill(wrong);
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByTestId("email-attempts-left")).toHaveText("4 attempts left");

    // The right code changes the address.
    await page.getByLabel("6-digit code").fill(code);
    await expect(page.getByTestId("email-changed")).toBeVisible();
    await expect(page.getByTestId("email-changed")).toBeFocused();
    await expect(page.getByTestId("current-email")).toHaveText(newEmail);

    // The other browser was signed out; this one was not.
    await other.page.goto("/en/account");
    await expect(other.page).toHaveURL(/\/en\/login\?next=/);
    await page.goto("/en/account");
    await expect(page.getByTestId("account-hello")).toBeVisible();

    // The OLD address was told it changed; the activity list shows the event.
    await expect
      .poll(async () =>
        (await emailsFor(oldEmail)).some((m) =>
          /address of your .* account was changed/i.test(m.subject),
        ),
      )
      .toBe(true);
    await page.goto("/en/account/security");
    await expect(page.getByTestId("activity-list")).toContainText("Email address changed");

    // Old address cannot sign in; the new one can, with the same password.
    await other.context.clearCookies();
    await other.page.goto("/en/login");
    await whenHydrated(other.page.getByRole("button", { name: "Sign in", exact: true }));
    await other.page.getByLabel("Email", { exact: true }).fill(oldEmail);
    await other.page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await other.page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(other.page.locator("form [role=alert]").first()).toHaveText(
      "Incorrect email or password.",
    );
    await other.page.getByLabel("Email", { exact: true }).fill(newEmail);
    await other.page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(other.page).toHaveURL(/\/en\/account$/);
    await other.context.close();
  });

  test("the cancel link works from another browser, only on a button press, and the code then fails", async ({
    page,
    browser,
    baseURL,
  }) => {
    const oldEmail = unique("cancel");
    const newEmail = unique("cancelnew");
    await registerAndVerify(page, oldEmail);
    await startChange(page, newEmail);
    await expect(page.getByTestId("email-code-form")).toBeVisible();
    const code = await codeFor(newEmail);
    const link = cancelLinkFrom((await waitForEmail(oldEmail, 2)).text);

    // Someone with no session opens the link: nothing happens until the button is pressed.
    const context = await browser.newContext({ baseURL });
    await context.addCookies([{ name: "consent", value: CONSENT, url: baseURL! }]);
    const cancelPage = await context.newPage();
    await cancelPage.goto(link);
    const button = cancelPage.getByRole("button", { name: "Cancel the email change" });
    await whenHydrated(button);
    await expect(button).toBeVisible();
    const results = await new AxeBuilder({ page: cancelPage }).analyze();
    expect(results.violations).toEqual([]);
    await button.click();
    await expect(cancelPage.getByTestId("cancel-done")).toBeVisible();
    await expect(cancelPage.getByTestId("cancel-done")).toBeFocused();
    await expect(cancelPage.getByRole("link", { name: "Reset your password" })).toBeVisible();
    await expect(cancelPage).not.toHaveURL(/token=/); // the used token is not left in the address bar
    await context.close();

    // The code that was mailed now leads nowhere, and the page goes back to the start.
    await page.getByLabel("6-digit code").fill(code);
    await expect(page.getByRole("alert").first()).toContainText(/no email change in progress/i);
    await expect(page.getByTestId("email-request-form")).toBeVisible();
    await page.goto("/en/account/email");
    await expect(page.getByTestId("current-email")).toHaveText(oldEmail);
  });

  test("an address that already has an account looks identical to the person asking; its owner is told by email", async ({
    page,
    browser,
    baseURL,
  }) => {
    const takenEmail = unique("taken");
    const me = unique("me");
    const owner = await browser.newContext({ baseURL });
    await owner.addCookies([{ name: "consent", value: CONSENT, url: baseURL! }]);
    await registerAndVerify(await owner.newPage(), takenEmail);
    await owner.close();

    await registerAndVerify(page, me);
    await startChange(page, takenEmail);
    // Same step, same words as for a free address.
    await expect(page.getByTestId("email-code-form")).toBeVisible();
    await expect(page.getByTestId("email-code-form")).toContainText(/t\*\*\*@example\.test/);
    // The old address is notified exactly as for a real change.
    expect((await waitForEmail(me, 2)).subject).toMatch(/email change was requested/i);
    // The owner gets the "already has an account" email, not a code.
    await expect
      .poll(async () =>
        (await emailsFor(takenEmail)).some((m) =>
          /already has an account/i.test(m.subject + m.text),
        ),
      )
      .toBe(true);
    const mails = await emailsFor(takenEmail);
    expect(mails.filter((m) => /confirmation code/i.test(m.subject))).toHaveLength(0);
    // Any code fails the same way as a wrong code for a free address.
    await page.getByLabel("6-digit code").fill("123456");
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByTestId("email-attempts-left")).toHaveText("4 attempts left");
  });

  test("'use a different address' returns to the form; resend sends a new code; same address is refused", async ({
    page,
  }) => {
    const me = unique("resend");
    const newEmail = unique("resendnew");
    await registerAndVerify(page, me);

    await startChange(page, me.toUpperCase());
    await expect(page.getByText("That is already your email address.")).toBeVisible();

    await page.getByLabel("New email address").fill(newEmail);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByTestId("email-code-form")).toBeVisible();
    const first = await codeFor(newEmail);

    await page.getByRole("button", { name: "Send a new code" }).click();
    await expect(page.getByTestId("email-notice")).toHaveText(
      "If the address can be used, we've sent a new code.",
    );
    const second = codeFrom(await waitForEmail(newEmail, 2));
    expect(second).toMatch(/^\d{6}$/);
    expect(first).toMatch(/^\d{6}$/);

    await page.getByTestId("email-discard").click();
    await expect(page.getByTestId("email-request-form")).toBeVisible();
  });

  test("the page needs a session, and is accessible in English and in Arabic (RTL)", async ({
    page,
  }) => {
    await page.goto("/en/account/email");
    await expect(page).toHaveURL(/\/en\/login\?next=/);

    await registerAndVerify(page, unique("a11y"));
    for (const locale of ["en", "ar"]) {
      await page.goto(`/${locale}/account/email`);
      await whenHydrated(page.getByRole("button").first());
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });
});
