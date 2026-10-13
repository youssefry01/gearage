import { expect, type Page } from "@playwright/test";

/**
 * Opens a mega-menu panel by hovering its trigger. Retries until the trigger reports aria-expanded, because a hover
 * that lands before React hydrates is lost (a real visitor cannot interact that fast, but a test can).
 */
export async function openMegaMenu(page: Page, name: string | RegExp): Promise<void> {
  const trigger = page.getByRole("button", { name });
  await expect(async () => {
    await page.mouse.move(0, 0);
    await trigger.hover();
    await expect(trigger).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

/** Opens the mobile drawer; retries for the same pre-hydration reason. */
export async function openDrawer(page: Page): Promise<void> {
  const menu = page.locator("header button[aria-haspopup=dialog]");
  await expect(async () => {
    await menu.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}
