import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { LOCALES, PAGES, THEMES } from "./viewports";

// axe runs in a real browser, so color-contrast is evaluated against the actual rendered theme.
for (const locale of LOCALES) {
  for (const theme of THEMES) {
    for (const page of PAGES) {
      test(`axe WCAG 2.2 AA: ${locale}${page || "/"} ${theme} theme`, async ({ page: p }) => {
        await p.addInitScript((t) => localStorage.setItem("theme", t), theme);
        await p.goto(`/${locale}${page}`);
        await p.evaluate(() => document.fonts.ready);
        await expect(p.locator("html")).toHaveAttribute("data-theme", theme);

        const results = await new AxeBuilder({ page: p })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          results.violations.map(
            (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
          ),
        ).toEqual([]);
      });
    }
  }
}
