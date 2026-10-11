import { expect, test } from "@playwright/test";
import { LOCALES, PAGES, VIEWPORTS } from "./viewports";

for (const locale of LOCALES) {
  for (const page of PAGES) {
    test.describe(`responsive ${locale}${page || "/"}`, () => {
      for (const vp of VIEWPORTS) {
        test(`${vp.name} (${vp.width}x${vp.height}): no horizontal scroll, 44px targets, correct direction`, async ({
          page: p,
        }) => {
          await p.setViewportSize({ width: vp.width, height: vp.height });
          const response = await p.goto(`/${locale}${page}`);
          expect(response?.status()).toBe(200);
          await p.evaluate(() => document.fonts.ready);

          await expect(p.locator("html")).toHaveAttribute("lang", locale);
          await expect(p.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");

          const overflow = await p.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }));
          expect(overflow.scrollWidth, "page scrolls horizontally").toBeLessThanOrEqual(
            overflow.clientWidth,
          );

          const small = await p.evaluate(() => {
            const selector =
              "a[href], button, input:not([type=hidden]), select, textarea, [role=button]";
            return (
              [...document.querySelectorAll<HTMLElement>(selector)]
                .filter((el) => !el.classList.contains("inline-link") && !el.closest("table"))
                .map((el) => ({ el, rect: el.getBoundingClientRect() }))
                // sr-only elements (skip link while unfocused) are 1px by design
                .filter(({ rect }) => rect.width > 1 && rect.height > 1)
                .filter(({ rect }) => Math.round(rect.width) < 44 || Math.round(rect.height) < 44)
                .map(
                  ({ el, rect }) =>
                    `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 24)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`,
                )
            );
          });
          expect(small, "interactive elements under 44x44px").toEqual([]);
        });
      }
    });
  }
}
