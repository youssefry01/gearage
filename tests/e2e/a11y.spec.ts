import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { openDrawer, openMegaMenu } from "./helpers";
import { LOCALES, PAGES, THEMES } from "./viewports";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
  );
}

// axe runs in a real browser, so color-contrast is evaluated against the actual rendered theme.
for (const locale of LOCALES) {
  for (const theme of THEMES) {
    test.describe(`${locale} ${theme}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      });

      for (const path of PAGES) {
        test(`axe WCAG 2.2 AA: ${path || "/"}`, async ({ page }) => {
          await page.goto(`/${locale}${path}`);
          await page.evaluate(() => document.fonts.ready);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          expect(await scan(page)).toEqual([]);
        });
      }

      test("axe: desktop with a mega-menu panel open", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(`/${locale}`);
        await openMegaMenu(page, /Components|المكونات/);
        expect(await scan(page)).toEqual([]);
      });

      test("axe: phone with the navigation drawer open", async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          hasTouch: true,
          isMobile: true,
        });
        await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
        const page = await context.newPage();
        await page.goto(`/${locale}`);
        await openDrawer(page);
        expect(await scan(page)).toEqual([]);
        await context.close();
      });
    });
  }

  test.describe(`${locale} cookie banner`, () => {
    test.use({ consent: false });
    test("axe: banner visible, then with details open", async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await scan(page)).toEqual([]);
      await page.getByRole("dialog").getByRole("button").last().click(); // "Customize"
      expect(await scan(page)).toEqual([]);
    });
  });
}
