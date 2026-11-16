import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Resolves once React has hydrated the element (it attaches its internal props object to every hydrated DOM node).
 * A click or hover that lands before that is silently lost, which is what made the first tests on a cold server
 * time out. Waiting for the real signal replaces "retry the action until it sticks".
 */
export async function whenHydrated(target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  await expect
    .poll(
      () => target.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps"))),
      {
        message: "element was never hydrated by React",
      },
    )
    .toBe(true);
}

/** Opens a mega-menu panel: wait for the trigger to hydrate, hover once, expect it to report aria-expanded. */
export async function openMegaMenu(page: Page, name: string | RegExp): Promise<void> {
  const trigger = page.getByRole("button", { name });
  await whenHydrated(trigger);
  await trigger.hover();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
}

/** Opens the mobile drawer: wait for its button to hydrate, click once, expect the dialog. */
export async function openDrawer(page: Page): Promise<void> {
  const menu = page.locator("header button[aria-haspopup=dialog]");
  await whenHydrated(menu);
  await menu.click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

/**
 * Signs out through the account page's Sign out button and returns only once the sign-out has FINISHED. The button's
 * action is awaited before the app navigates home, so the URL reaching the home page and the session cookie being gone
 * are the proof. Navigating right after the click instead cancels the in-flight Server Action and, when it had not
 * finished, the session survives (the race behind the flaky "next parameter" test). Never click Sign out and then goto.
 */
export async function signOut(page: Page): Promise<void> {
  const button = page.getByTestId("logout");
  await whenHydrated(button);
  await button.click();
  await page.waitForURL(/\/(en|ar)\/?$/);
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((c) => c.name.includes("session_token")),
    )
    .toBe(false);
}
