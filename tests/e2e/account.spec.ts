import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { codeFrom, emailsFor, waitForEmail } from "./emails";
import { whenHydrated } from "./helpers";

// Account area (M5b-1): profile, change password, sessions, security activity. Every test registers its own throw-away
// account; "another browser" is a second browser context with a different User-Agent (a real second device as far as
// the server can tell: its own cookie jar and its own session).
const PASSWORD = "correct-horse-battery-staple-91";
const NEW_PASSWORD = "a completely different passphrase 2026";
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

/** A second browser: own cookies, a Firefox-on-macOS User-Agent, signed in with the password. */
async function secondBrowser(
  browser: Browser,
  baseURL: string,
  email: string,
  password = PASSWORD,
) {
  const context = await browser.newContext({ baseURL, userAgent: FIREFOX_MAC });
  await context.addCookies([{ name: "consent", value: CONSENT, url: baseURL }]);
  const page = await context.newPage();
  await page.goto("/en/login");
  await whenHydrated(page.getByRole("button", { name: "Sign in", exact: true }));
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/account$/);
  return { context, page };
}

test.describe("account area", () => {
  test("the three account pages need a session and bring you back after signing in", async ({
    page,
  }) => {
    for (const path of ["/account", "/account/profile", "/account/security", "/account/email"]) {
      await page.goto(`/en${path}`);
      await expect(page).toHaveURL(
        new RegExp(`/en/login\\?next=${encodeURIComponent(path).replace(/%/g, "%")}`),
      );
    }
  });

  test("overview shows the details and links to profile and security", async ({ page }) => {
    await registerAndVerify(page, unique("overview"));
    await expect(page.getByTestId("account-hello")).toContainText("Mona");
    await expect(page.getByText("01012345678")).toBeVisible(); // shown the way people write it
    const nav = page.getByRole("navigation", { name: "Account sections" });
    await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await nav.getByRole("link", { name: "Profile" }).click();
    await expect(page).toHaveURL(/\/en\/account\/profile$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Profile");
  });

  test("profile: edits persist, the phone shows the Egyptian-number message, the field stops at 17 characters", async ({
    page,
  }) => {
    await registerAndVerify(page, unique("profile"));
    await page.goto("/en/account/profile");
    await whenHydrated(page.getByRole("button", { name: "Save changes" }));
    const phone = page.getByLabel("Mobile number");
    await expect(phone).toHaveValue("01012345678");

    await phone.fill("1".repeat(40));
    expect((await phone.inputValue()).length).toBe(17);

    await phone.fill("12345");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("form [role=alert]").first()).toHaveText(
      "Enter an Egyptian mobile number like 01012345678",
    );

    await page.getByLabel("First name").fill("Salma");
    await phone.fill("011 2345 6789");
    await page.getByLabel("Date of birth (optional)").fill("1992-03-04");
    await page.getByLabel("Gender (optional)").selectOption("female");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("profile-saved")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("First name")).toHaveValue("Salma");
    await expect(page.getByLabel("Mobile number")).toHaveValue("01123456789");
    await expect(page.getByLabel("Date of birth (optional)")).toHaveValue("1992-03-04");
    await expect(page.getByLabel("Gender (optional)")).toHaveValue("female");
    await page.goto("/en/account");
    await expect(page.getByTestId("account-hello")).toContainText("Salma");
  });

  test("profile: a date of birth under 16 is refused with a clear message", async ({ page }) => {
    await registerAndVerify(page, unique("young"));
    await page.goto("/en/account/profile");
    await whenHydrated(page.getByRole("button", { name: "Save changes" }));
    const year = new Date().getFullYear() - 10;
    await page.getByLabel("Date of birth (optional)").fill(`${year}-01-01`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("You must be at least 16 to create an account.")).toBeVisible();
  });

  test("security: sessions list shows this device and another browser; signing one out ends only that one", async ({
    page,
    browser,
    baseURL,
  }) => {
    const email = unique("sessions");
    await registerAndVerify(page, email);
    const other = await secondBrowser(browser, baseURL!, email);

    await page.goto("/en/account/security");
    const list = page.getByTestId("sessions-list");
    await expect(list.getByTestId("session-current")).toContainText("This device");
    await expect(list.getByTestId("session-current").getByTestId("session-device")).toHaveText(
      /^Chrome on (Windows|macOS|Linux)$/,
    );
    const others = list.getByTestId("session-other");
    await expect(others).toHaveCount(1);
    await expect(others.getByTestId("session-device")).toHaveText("Firefox on macOS");
    // "Signed in" has date and time (exact: from the session's creation time); "Last active" is a date only.
    await expect(list.getByTestId("session-current")).toContainText(/Signed in .*\d{1,2}:\d{2}/);
    await expect(list.getByTestId("session-current")).toContainText(
      /Last active [A-Z][a-z]{2} \d{1,2}, \d{4}(?!.*\d:\d)/,
    );
    await expect(list.getByTestId("session-current").getByRole("button")).toHaveCount(0); // no sign-out for this device here

    await whenHydrated(others.getByRole("button", { name: /Sign out Firefox on macOS/ }));
    await others.getByRole("button", { name: /Sign out Firefox on macOS/ }).click();
    await expect(page.getByTestId("sessions-notice")).toHaveText("Signed out of 1 device.");
    await expect(page.getByTestId("session-other")).toHaveCount(0);

    // The other browser is signed out at once: its next request is sent to sign in.
    await other.page.goto("/en/account");
    await expect(other.page).toHaveURL(/\/en\/login\?next=/);
    // This browser is still signed in.
    await page.reload();
    await expect(page.getByTestId("session-current")).toBeVisible();
    await other.context.close();
  });

  test("security: 'Sign out of other devices' keeps this device and ends the rest", async ({
    page,
    browser,
    baseURL,
  }) => {
    const email = unique("others");
    await registerAndVerify(page, email);
    const b = await secondBrowser(browser, baseURL!, email);
    const c = await secondBrowser(browser, baseURL!, email);

    await page.goto("/en/account/security");
    await expect(page.getByTestId("session-other")).toHaveCount(2);
    await whenHydrated(page.getByTestId("sign-out-others"));
    await page.getByTestId("sign-out-others").click();
    await expect(page.getByTestId("sessions-notice")).toHaveText("Signed out of 2 devices.");
    // The result is announced politely and as one sentence, and the region is always in the page.
    await expect(page.getByTestId("sessions-notice")).toHaveAttribute("aria-live", "polite");
    await expect(page.getByTestId("sessions-notice")).toHaveAttribute("aria-atomic", "true");
    await expect(page.getByTestId("session-other")).toHaveCount(0);
    await expect(page.getByText("You're not signed in anywhere else.")).toBeVisible();
    await expect(page.getByTestId("sign-out-others")).toHaveCount(0);

    for (const { page: p } of [b, c]) {
      await p.goto("/en/account");
      await expect(p).toHaveURL(/\/en\/login\?next=/);
    }
    await page.goto("/en/account");
    await expect(page.getByTestId("account-hello")).toBeVisible(); // this device is still in
    await b.context.close();
    await c.context.close();
  });

  test("security: changing the password keeps this device, signs out the others, emails a notice and the new password works", async ({
    page,
    browser,
    baseURL,
  }) => {
    const email = unique("pw");
    await registerAndVerify(page, email);
    const other = await secondBrowser(browser, baseURL!, email);

    await page.goto("/en/account/security");
    await whenHydrated(page.getByRole("button", { name: "Change password" }));
    await expect(page.getByText(/You can use any language/)).toBeVisible();

    // A wrong current password is refused and changes nothing.
    await page.getByLabel("Current password", { exact: true }).fill("not-my-password-0000");
    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("That isn't your current password.")).toBeVisible();
    await other.page.goto("/en/account");
    await expect(other.page.getByTestId("account-hello")).toBeVisible(); // still signed in there

    // The same password is refused.
    await page.getByLabel("Current password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("New password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(
      page.getByText("Choose a password that is different from your current one."),
    ).toBeVisible();

    // A new password in another language, with spaces, is accepted.
    await page.getByLabel("Current password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByTestId("password-changed")).toBeVisible();
    await expect(page.getByLabel("Current password", { exact: true })).toHaveValue("");

    // The other browser is signed out; this one is not.
    await other.page.goto("/en/account");
    await expect(other.page).toHaveURL(/\/en\/login\?next=/);
    await page.reload();
    await expect(page.getByTestId("session-current")).toBeVisible();
    await expect(page.getByTestId("session-other")).toHaveCount(0);

    // The notice email names the device and offers a reset.
    await expect
      .poll(async () =>
        (await emailsFor(email)).some((m) => /password was changed/i.test(m.subject)),
      )
      .toBe(true);
    const notice = (await emailsFor(email)).find((m) => /password was changed/i.test(m.subject))!;
    expect(notice.text).toMatch(/Chrome on (Windows|macOS|Linux)/);
    expect(notice.text).toMatch(/\/en\/forgot-password/);

    // Old password no longer signs in; the new one does.
    await other.context.clearCookies();
    await other.page.goto("/en/login");
    await whenHydrated(other.page.getByRole("button", { name: "Sign in", exact: true }));
    await other.page.getByLabel("Email", { exact: true }).fill(email);
    await other.page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await other.page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(other.page.locator("form [role=alert]").first()).toHaveText(
      "Incorrect email or password.",
    );
    await other.page.getByLabel("Password", { exact: true }).fill(NEW_PASSWORD);
    await other.page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(other.page).toHaveURL(/\/en\/account$/);
    await other.context.close();
  });

  test("security: the activity list shows sign-ins with their device and security changes, newest first", async ({
    page,
    browser,
    baseURL,
  }) => {
    const email = unique("activity");
    await registerAndVerify(page, email);
    const other = await secondBrowser(browser, baseURL!, email);
    await page.goto("/en/account/security");
    await whenHydrated(page.getByTestId("sign-out-others"));
    await page.getByTestId("sign-out-others").click();
    await expect(page.getByTestId("sessions-notice")).toBeVisible();
    await page.reload();

    const events = page.getByTestId("activity-event");
    await expect(events.first()).toContainText("Other devices were signed out");
    await expect(page.getByTestId("activity-list")).toContainText("Signed in on Firefox on macOS");
    await expect(page.getByTestId("activity-list")).toContainText(
      /Signed in on Chrome on (Windows|macOS|Linux)/,
    );
    await expect(page.getByTestId("activity-list")).not.toContainText(/\d+\.\d+\.\d+\.\d+/); // no IP address
    await other.context.close();
  });

  test("Arabic: the security page renders right-to-left with translated labels and device names", async ({
    page,
    context,
    baseURL,
  }) => {
    await registerAndVerify(page, unique("ar"));
    await context.addCookies([{ name: "NEXT_LOCALE", value: "ar", url: baseURL! }]);
    await page.goto("/ar/account/security");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("الأمان");
    await expect(page.getByTestId("session-current")).toContainText("هذا الجهاز");
    await expect(page.getByTestId("session-device")).toHaveText(
      /^Chrome على (Windows|macOS|Linux)$/,
    );
    // No horizontal page scroll at phone width.
    await page.setViewportSize({ width: 320, height: 700 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  for (const theme of ["dark", "light"] as const) {
    test(`accessibility: the security page with another device, notices and activity, in ${theme} (en and ar)`, async ({
      page,
      browser,
      baseURL,
      context,
    }) => {
      const email = unique(`axe-${theme}`);
      await registerAndVerify(page, email);
      const other = await secondBrowser(browser, baseURL!, email);
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      for (const locale of ["en", "ar"] as const) {
        await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL! }]);
        await page.goto(`/${locale}/account/security`);
        await whenHydrated(page.getByTestId("sign-out-others"));
        // Trigger the visible notice and an error alert too, so those states are scanned.
        await page
          .getByLabel(locale === "en" ? "Current password" : "كلمة المرور الحالية", { exact: true })
          .fill("x");
        await page
          .getByLabel(locale === "en" ? "New password" : "كلمة المرور الجديدة", { exact: true })
          .fill("short");
        await page.locator("[data-testid=password-form] button[type=submit]").click();
        await expect(
          page.locator("[data-testid=password-form] [role=alert]").first(),
        ).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          results.violations.map(
            (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
          ),
        ).toEqual([]);
      }
      await other.context.close();
    });
  }
});
