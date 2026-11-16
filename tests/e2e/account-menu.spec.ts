import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { codeFrom, waitForEmail } from "./emails";
import { expect, test } from "./fixtures";
import { signOut, whenHydrated } from "./helpers";
import { preparePage } from "./page-setup";
import { LOCALES, THEMES, VIEWPORTS } from "./viewports";

// M5b-2b: the header's account menu (ADR 0028) and the account shell. Tests that only LOOK use the session saved by the
// global setup (read-only); tests that sign out or edit register their own throw-away account.
const PASSWORD = "correct-horse-battery-staple-91";
let counter = 0;
const unique = (label: string) => `${label}-${Date.now()}-${counter++}@example.test`;

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

const trigger = (page: Page) => page.getByTestId("account-menu-trigger");
const panel = (page: Page) => page.getByTestId("account-menu-panel");

test.describe("header account menu: signed out", () => {
  test("a button once the server has answered; Sign in and Create account inside", async ({
    page,
  }) => {
    await page.goto("/en");
    await whenHydrated(trigger(page));
    await expect(trigger(page)).toHaveAttribute("aria-expanded", "false");
    await trigger(page).click();
    await expect(trigger(page)).toHaveAttribute("aria-expanded", "true");
    await expect(panel(page).getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(panel(page).getByRole("link", { name: "Create account" })).toBeVisible();
    await panel(page).getByRole("link", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/register$/);
    await expect(panel(page)).toHaveCount(0); // navigating closes it
  });

  test("keyboard: Enter opens, Escape closes and returns focus, Tab out closes, a click outside closes", async ({
    page,
  }) => {
    await page.goto("/en");
    await whenHydrated(trigger(page));
    await trigger(page).focus();
    await page.keyboard.press("Enter");
    await expect(trigger(page)).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(panel(page).getByRole("link", { name: "Sign in" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();

    await page.keyboard.press("Space");
    await expect(trigger(page)).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab"); // past the last link: focus leaves the menu
    await expect(panel(page)).toHaveCount(0);

    await trigger(page).click();
    await expect(panel(page)).toBeVisible();
    await page
      .getByRole("heading", { level: 1 })
      .first()
      .click({ position: { x: 1, y: 1 } });
    await expect(panel(page)).toHaveCount(0);
  });
});

test.describe("header account menu: signed in", () => {
  test("shows the initial, lists the sections, follows a profile edit, and signs out from the menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerAndVerify(page, unique("menu"));
    await whenHydrated(trigger(page));
    await expect(trigger(page)).toContainText("M");
    await expect(trigger(page)).toContainText("Hello, Mona");

    await trigger(page).click();
    await expect(panel(page)).toContainText("Signed in as Mona");
    for (const name of ["My account", "Profile", "Security"]) {
      await expect(panel(page).getByRole("link", { name })).toBeVisible();
    }
    await panel(page).getByRole("link", { name: "Profile" }).click();
    await expect(page).toHaveURL(/\/en\/account\/profile$/);
    await expect(panel(page)).toHaveCount(0);

    // A new first name reaches the header without a reload.
    await whenHydrated(page.getByRole("button", { name: "Save changes" }));
    await page.getByLabel("First name").fill("Salma");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(trigger(page)).toContainText("Hello, Salma");

    // Sign out from the menu: the session is gone, the header flips, and /account asks for a sign-in again.
    await trigger(page).click();
    await page.getByTestId("account-menu-signout").click();
    await page.waitForURL(/\/en\/?$/);
    await expect
      .poll(async () =>
        (await page.context().cookies()).some((c) => c.name.includes("session_token")),
      )
      .toBe(false);
    await trigger(page).click();
    await expect(panel(page).getByRole("link", { name: "Sign in" })).toBeVisible();
    await page.goto("/en/account");
    await expect(page).toHaveURL(/\/en\/login\?next=/);
  });

  test("signing in from the login page shows the signed-in header on the page it lands on", async ({
    page,
  }) => {
    const email = unique("relogin");
    await registerAndVerify(page, email);
    await signOut(page);
    await page.goto("/en/login?next=%2Fen%2Fcart");
    await whenHydrated(page.getByRole("button", { name: "Sign in", exact: true }));
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/cart$/);
    await expect(trigger(page)).toContainText("M");
    await trigger(page).click();
    await expect(page.getByTestId("account-menu-signout")).toBeVisible();
  });
});

test.describe("header account menu: the panel stays inside every viewport, in both directions", () => {
  for (const locale of LOCALES) {
    for (const vp of VIEWPORTS) {
      test.describe(`${locale} ${vp.name}`, () => {
        test.use({
          viewport: { width: vp.width, height: vp.height },
          hasTouch: vp.touch,
          isMobile: vp.touch,
        });
        for (const state of ["signed-in", "signed-out"] as const) {
          test(`${state}: inside the viewport, 44px items, no horizontal scroll`, async ({
            page,
            context,
            baseURL,
          }) => {
            if (state === "signed-in") await preparePage(context, baseURL!, "/account");
            await page.goto(`/${locale}`);
            await whenHydrated(trigger(page));
            await trigger(page).click();
            await expect(panel(page)).toBeVisible();
            const box = (await panel(page).boundingBox())!;
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
            const items = panel(page).locator("a, button");
            for (let i = 0; i < (await items.count()); i++) {
              const b = (await items.nth(i).boundingBox())!;
              expect(Math.round(b.height), `item ${i}`).toBeGreaterThanOrEqual(44);
            }
            const overflow = await page.evaluate(
              () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            );
            expect(overflow).toBeLessThanOrEqual(0);
          });
        }
      });
    }
  }
});

test.describe("header account menu: accessibility", () => {
  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      for (const width of [320, 1280]) {
        test(`${locale} ${theme} ${width}px: no axe violations with the menu open (both states)`, async ({
          page,
          context,
          baseURL,
        }) => {
          await page.setViewportSize({ width, height: 800 });
          await page.emulateMedia({ colorScheme: theme });
          for (const state of ["signed-out", "signed-in"] as const) {
            if (state === "signed-in") await preparePage(context, baseURL!, "/account");
            await page.goto(`/${locale}`);
            await whenHydrated(trigger(page));
            await trigger(page).click();
            await expect(panel(page)).toBeVisible();
            const results = await new AxeBuilder({ page }).analyze();
            expect(results.violations, state).toEqual([]);
          }
        });
      }
    }
  }
});

test.describe("account shell", () => {
  for (const locale of LOCALES) {
    test(`${locale}: Sign out is reachable on every account page at 320px and 1280px; the menu is a column on desktop and a row on phones`, async ({
      page,
      context,
      baseURL,
    }) => {
      await preparePage(context, baseURL!, "/account");
      for (const path of ["/account", "/account/profile", "/account/security", "/account/email"]) {
        for (const width of [320, 1280]) {
          await page.setViewportSize({ width, height: 800 });
          await page.goto(`/${locale}${path}`);
          const nav = page.getByRole("navigation").filter({ has: page.getByTestId("logout") });
          await expect(nav).toBeVisible();
          const links = nav.locator("a");
          const boxes = [];
          for (let i = 0; i < (await links.count()); i++)
            boxes.push((await links.nth(i).boundingBox())!);
          const out = (await page.getByTestId("logout").boundingBox())!;
          for (const b of [...boxes, out]) {
            expect(Math.round(b.height)).toBeGreaterThanOrEqual(44);
            expect(b.x).toBeGreaterThanOrEqual(0);
            expect(b.x + b.width).toBeLessThanOrEqual(width);
          }
          if (width >= 1024) {
            // A column: each item starts below the previous one; Sign out is last.
            for (let i = 1; i < boxes.length; i++)
              expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y);
            expect(out.y).toBeGreaterThan(boxes[boxes.length - 1]!.y);
          } else {
            // A row (it wraps): the first two sections share a line.
            expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(4);
          }
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          expect(overflow).toBeLessThanOrEqual(0);
        }
      }
    });
  }

  test("Security shows the email with a Change button that opens the flow, and the flow stays under Security", async ({
    page,
  }) => {
    const email = unique("security");
    await registerAndVerify(page, email);
    await page.goto("/en/account/security");
    const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
    expect(headings.slice(0, 4)).toEqual([
      "Change password",
      "Email address",
      "Where you're signed in",
      "Recent security activity",
    ]);
    await expect(page.getByTestId("security-email")).toHaveText(email);
    await page.getByTestId("security-email-change").click();
    await expect(page).toHaveURL(/\/en\/account\/email$/);
    await expect(page.getByTestId("account-nav-security")).toHaveAttribute("aria-current", "page");
    await page.getByTestId("email-back").click();
    await expect(page).toHaveURL(/\/en\/account\/security$/);
  });
});
