import { expect, test } from "./fixtures";
import { LOCALES, PAGES, VIEWPORTS } from "./viewports";

for (const locale of LOCALES) {
  for (const path of PAGES) {
    test.describe(`responsive ${locale}${path || "/"}`, () => {
      for (const vp of VIEWPORTS) {
        test.describe(vp.name, () => {
          test.use({
            viewport: { width: vp.width, height: vp.height },
            hasTouch: vp.touch,
            isMobile: vp.touch,
          });

          test(`(${vp.width}x${vp.height}${vp.touch ? ", touch" : ""}): no horizontal scroll, target sizes, direction`, async ({
            page,
          }) => {
            const response = await page.goto(`/${locale}${path}`);
            expect(response?.status()).toBe(200);
            await page.evaluate(() => document.fonts.ready);

            await expect(page.locator("html")).toHaveAttribute("lang", locale);
            await expect(page.locator("html")).toHaveAttribute(
              "dir",
              locale === "ar" ? "rtl" : "ltr",
            );

            const overflow = await page.evaluate(() => ({
              scrollWidth: document.documentElement.scrollWidth,
              clientWidth: document.documentElement.clientWidth,
            }));
            expect(overflow.scrollWidth, "page scrolls horizontally").toBeLessThanOrEqual(
              overflow.clientWidth,
            );

            // 44px everywhere. The ONE exception: the dense desktop top bar may be 32px with a fine pointer
            // (`pointer-coarse:` variants lift it to 44px on touch screens).
            const small = await page.evaluate(() => {
              const coarse = window.matchMedia("(pointer: coarse)").matches;
              const selector =
                "a[href], button, input:not([type=hidden]), select, textarea, [role=button]";
              return [...document.querySelectorAll<HTMLElement>(selector)]
                .filter((el) => !el.classList.contains("inline-link") && !el.closest("table"))
                .map((el) => ({ el, rect: el.getBoundingClientRect() }))
                .filter(({ rect }) => rect.width > 1 && rect.height > 1) // sr-only (unfocused skip link) is 1px
                .filter(({ el, rect }) => {
                  const min = !coarse && el.closest("[data-topbar]") ? 32 : 44;
                  return Math.round(rect.width) < min || Math.round(rect.height) < min;
                })
                .map(
                  ({ el, rect }) =>
                    `${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 24)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`,
                );
            });
            expect(small, "interactive elements below the minimum target size").toEqual([]);
          });
        });
      }
    });
  }
}
