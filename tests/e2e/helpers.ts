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
