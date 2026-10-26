import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { whenHydrated } from "./helpers";

// Needs the seeded catalog (CI seeds it; locally run `npm run db:seed` first).

const box = (page: Page) => page.locator("#site-search");

test.describe("header search suggestions", () => {
  test("typing shows suggestions; the arrow keys move the highlight; Enter opens the product", async ({
    page,
  }) => {
    await page.goto("/en");
    const input = box(page);
    await whenHydrated(input);
    await expect(input).toHaveAttribute("role", "combobox");
    await expect(input).toHaveAttribute("aria-expanded", "false");

    await input.fill("rtx 4060");
    const list = page.getByRole("listbox", { name: "Search suggestions" });
    await expect(list).toBeVisible();
    await expect(input).toHaveAttribute("aria-expanded", "true");
    await expect(input).toHaveAttribute("aria-controls", /.+/);
    const options = list.getByRole("option");
    await expect(options.first()).toContainText("RTX 4060");
    await expect(page.getByRole("status").filter({ hasText: /suggestion/ })).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    const activeId = await input.getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    await expect(page.locator(`[id="${activeId}"]`)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(options.first()).toHaveAttribute("aria-selected", "false");
    await page.keyboard.press("ArrowUp");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/p\//);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("RTX 4060");
  });

  test("arrowing through a list that scrolls keeps the highlighted option in view", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 420 });
    await page.goto("/en");
    const input = box(page);
    await whenHydrated(input);
    await input.fill("gaming");
    const list = page.getByRole("listbox", { name: "Search suggestions" });
    const options = list.getByRole("option");
    await expect(options.nth(4)).toBeVisible();
    const count = await options.count();
    for (let i = 0; i < count; i++) await page.keyboard.press("ArrowDown");
    const last = options.nth(count - 1);
    await expect(last).toHaveAttribute("aria-selected", "true");
    await expect(last).toBeInViewport();
    // ...and wraps back to the top
    await page.keyboard.press("ArrowDown");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await expect(options.first()).toBeInViewport();
  });

  test("a list that scrolls can be reached with Tab and stays open while focus is inside the search", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 420 });
    await page.goto("/en");
    const input = box(page);
    await whenHydrated(input);
    await input.fill("gaming");
    const list = page.getByRole("listbox", { name: "Search suggestions" });
    await expect(list).toBeVisible();
    const panel = page.getByRole("group", { name: "Search suggestions" });
    await expect(panel).toHaveAttribute("tabindex", "0");
    await page.keyboard.press("Tab"); // the submit button
    await page.keyboard.press("Tab"); // the scrolling list
    await expect(panel).toBeFocused();
    await expect(list).toBeVisible();
    await page.keyboard.press("Tab"); // leaves the search: the list closes
    await expect(list).toBeHidden();
  });

  test("Escape closes the list and keeps the text; the last row searches everything", async ({
    page,
  }) => {
    await page.goto("/en");
    const input = box(page);
    await whenHydrated(input);
    await input.fill("kingston");
    const list = page.getByRole("listbox", { name: "Search suggestions" });
    await expect(list).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
    await expect(input).toHaveValue("kingston");
    await expect(input).toHaveAttribute("aria-expanded", "false");

    await input.fill("kingstons");
    await expect(list).toBeVisible();
    await list.getByRole("option", { name: /See all \d+ results/ }).click();
    await expect(page).toHaveURL(/\/en\/search\?q=kingstons$/);
  });

  test("groups products, categories and brands, and says when it corrected a typo", async ({
    page,
  }) => {
    await page.goto("/en");
    const input = box(page);
    await whenHydrated(input);
    await input.fill("nvidea");
    const list = page.getByRole("listbox", { name: "Search suggestions" });
    await expect(list.getByText(/Showing suggestions for “nvidia”/)).toBeVisible();
    await expect(list.getByText("Brands")).toBeVisible();
    await expect(list.getByRole("option", { name: "NVIDIA", exact: true })).toBeVisible();
    await expect(list.getByRole("option", { name: "NVIDIA GeForce", exact: true })).toBeVisible();
  });

  test("a term with no match says so and still lets Enter search", async ({ page }) => {
    await page.goto("/en");
    const input = box(page);
    await whenHydrated(input);
    await input.fill("xyzzyx");
    await expect(
      page.getByRole("listbox", { name: "Search suggestions" }).getByText(/No suggestions/),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/search\?q=xyzzyx$/);
  });

  test("one character does not open the list", async ({ page }) => {
    await page.goto("/en");
    const input = box(page);
    await whenHydrated(input);
    await input.fill("r");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("Arabic: suggestions in Arabic, the list stays inside the viewport and mirrors", async ({
    page,
  }) => {
    await page.goto("/ar");
    const input = box(page);
    await whenHydrated(input);
    await input.fill("كارت شاشة");
    const list = page.getByRole("listbox", { name: "اقتراحات البحث" });
    await expect(list).toBeVisible();
    const first = list.getByRole("option").first();
    expect(((await first.textContent()) ?? "").length).toBeGreaterThan(5);
    const b = await list.boundingBox();
    const vw = page.viewportSize()?.width ?? 0;
    expect((b?.x ?? -1) >= 0 && (b?.x ?? 0) + (b?.width ?? 0) <= vw).toBe(true);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});

test.describe("search results page", () => {
  test("shows the matches, the count and the term in the heading and the box", async ({ page }) => {
    await page.goto("/en/search?q=rtx+4060");
    await expect(
      page.getByRole("heading", { level: 1, name: "Results for “rtx 4060”" }),
    ).toBeVisible();
    await expect(page.getByTestId("product-card").first()).toContainText("RTX 4060");
    await expect(page.getByRole("status").filter({ hasText: /\d+ products?/ })).toBeVisible();
    await expect(box(page)).toHaveValue("rtx 4060");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
  });

  test("is never indexed: noindex, self canonical, no hreflang", async ({ page }) => {
    await page.goto("/en/search?q=rtx+4060");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/en\/search\?q=rtx\+4060$/,
    );
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
    await page.goto("/en/search");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("Arabic: finds products with an Arabic query and renders right-to-left", async ({
    page,
  }) => {
    await page.goto("/ar/search?q=" + encodeURIComponent("كارت شاشة"));
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("نتائج البحث عن");
    const first = page.getByTestId("product-card").first();
    await expect(first).toBeVisible();
    expect((await first.locator("h3").textContent()) ?? "").toMatch(/[\u0600-\u06FF]/);
  });

  test("a misspelled word is corrected and the page says so", async ({ page }) => {
    await page.goto("/en/search?q=ryzn+5+5600");
    await expect(
      page.getByText("No results for “ryzn 5 5600”. Showing results for “ryzen 5 5600”."),
    ).toBeVisible();
    await expect(page.getByTestId("product-card").first()).toContainText("Ryzen 5 5600");
  });

  test("partial matches are labelled as such", async ({ page }) => {
    await page.goto("/en/search?q=rtx+4070");
    await expect(page.getByText(/No product matches every word of “rtx 4070”/)).toBeVisible();
    await expect(page.getByTestId("product-card").first()).toBeVisible();
  });

  test("no results: says so, offers categories, and the categories work", async ({ page }) => {
    await page.goto("/en/search?q=xyzzy");
    await expect(page.getByRole("heading", { name: "No results for “xyzzy”" })).toBeVisible();
    await expect(page.getByTestId("product-card")).toHaveCount(0);
    const cats = page.getByRole("navigation", { name: "Browse categories" });
    await expect(cats).toBeVisible();
    await cats.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/en\/c\//);
  });

  test("a term that is too short asks for more", async ({ page }) => {
    await page.goto("/en/search?q=a");
    await expect(page.getByRole("heading", { name: "Type a little more" })).toBeVisible();
  });

  test("with no term it lists the whole catalog, sortable and filterable", async ({ page }) => {
    await page.goto("/en/search");
    await expect(page.getByRole("heading", { level: 1, name: "All products" })).toBeVisible();
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Sort by" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Clear search" })).toHaveCount(0);
  });

  test("hostile input is shown as text and never executed", async ({ page }) => {
    let dialog = false;
    page.on("dialog", async (d) => {
      dialog = true;
      await d.dismiss();
    });
    await page.goto("/en/search?q=" + encodeURIComponent("<img src=x onerror=alert(1)>"));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "<img src=x onerror=alert(1)>",
    );
    expect(dialog).toBe(false);
    await page.goto("/en/search?q=" + encodeURIComponent("'; DROP TABLE product; --"));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/en/search?q=" + "x".repeat(400));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("a page number past the end is a 404", async ({ page }) => {
    const res = await page.goto("/en/search?q=gaming&page=99");
    expect(res?.status()).toBe(404);
  });
});

test.describe("filters, sorting and categories keep the search", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("choosing a filter keeps the term; removing the chip keeps it too", async ({ page }) => {
    await page.goto("/en/search?q=gaming");
    const filters = page.locator("aside");
    await whenHydrated(filters.getByRole("checkbox", { name: /In stock/ }));
    await filters.getByRole("checkbox", { name: /In stock/ }).check();
    await expect(page).toHaveURL(/q=gaming/);
    await expect(page).toHaveURL(/in_stock=1/, { timeout: 15_000 });
    await expect(box(page)).toHaveValue("gaming");
    await page
      .getByRole("link", { name: /Remove filter.*In stock|In stock/i })
      .first()
      .click();
    await expect(page).toHaveURL(/q=gaming/);
    await expect(page).not.toHaveURL(/in_stock/);
  });

  test("sorting keeps the term and offers relevance first", async ({ page }) => {
    await page.goto("/en/search?q=ddr5");
    const sort = page.getByRole("combobox", { name: "Sort by" });
    await whenHydrated(sort);
    await expect(sort).toHaveValue("relevance");
    await sort.selectOption("price-asc");
    await expect(page).toHaveURL(/q=ddr5/);
    await expect(page).toHaveURL(/sort=price-asc/);
  });

  test("the category list narrows the search, shows spec filters, and can be undone", async ({
    page,
  }) => {
    await page.goto("/en/search?q=gaming");
    const nav = page.getByRole("navigation", { name: "Narrow by category" });
    await expect(nav).toBeVisible();
    await nav.getByRole("link").nth(1).click();
    await expect(page).toHaveURL(/category=/);
    await expect(page).toHaveURL(/q=gaming/);
    await expect(page.getByRole("link", { name: /Remove filter/ }).first()).toBeVisible();
    await page
      .getByRole("navigation", { name: "Narrow by category" })
      .getByRole("link", { name: "All categories" })
      .click();
    await expect(page).not.toHaveURL(/category=/);
  });

  test("a category page ignores ?q= (it never turns into a search)", async ({ page }) => {
    await page.goto("/en/c/components/cpus?q=nvidia");
    await expect(page.getByRole("heading", { level: 1, name: "CPUs" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });
});

test.describe("home page 'View all' links and Deals", () => {
  test("each rail links to the results page with its own filters", async ({ page }) => {
    await page.goto("/en");
    for (const [rail, params] of [
      ["Deals", /sale=1.*sort=discount|sort=discount.*sale=1/],
      ["Best sellers", /sort=best-selling/],
      ["New arrivals", /sort=newest/],
    ] as const) {
      const section = page.locator("section", {
        has: page.getByRole("heading", { level: 2, name: rail }),
      });
      const link = section.getByRole("link", { name: new RegExp(`View all: ${rail}`) });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", /\/en\/search\?/);
      await expect(link).toHaveAttribute("href", params);
      await expect(link).toHaveAttribute("href", /in_stock=1/);
    }
  });

  test("clicking 'View all' lands on a page that lists products", async ({ page }) => {
    await page.goto("/en");
    const link = page.getByRole("link", { name: /View all: Deals/ });
    await whenHydrated(link);
    await link.click();
    await expect(page).toHaveURL(/\/en\/search\?.*sale=1/);
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Sort by" })).toHaveValue("discount");
  });

  test("the Deals link in the footer and menus reaches the same view", async ({
    page,
    request,
  }) => {
    const res = await request.get("/en/deals", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toMatch(/\/en\/search\?.*sale=1.*sort=discount/);
    await page.goto("/en/deals");
    await expect(page).toHaveURL(/\/en\/search\?/);
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await page.goto("/ar/deals");
    await expect(page).toHaveURL(/\/ar\/search\?/);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the search box is a plain form that reaches the results", async ({ page }) => {
    await page.goto("/en");
    await page.locator("#site-search").fill("rtx 4060");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/search\?q=rtx\+4060$/);
    await expect(page.getByTestId("product-card").first()).toContainText("RTX 4060");
  });
});

test.describe("suggestions API", () => {
  test("returns the shaped result, cacheable, and rejects oversized input", async ({ request }) => {
    const ok = await request.get("/api/search/suggest?q=rtx");
    expect(ok.status()).toBe(200);
    expect(ok.headers()["cache-control"]).toMatch(/s-maxage=60/);
    const body = (await ok.json()) as { ok: boolean; data: { products: unknown[]; total: number } };
    expect(body.ok).toBe(true);
    expect(body.data.products.length).toBeGreaterThan(0);
    expect(body.data.products.length).toBeLessThanOrEqual(5);

    const empty = await request.get("/api/search/suggest?q=a");
    expect(((await empty.json()) as { data: { products: unknown[] } }).data.products).toEqual([]);

    const huge = await request.get("/api/search/suggest?q=" + "x".repeat(300));
    expect(huge.status()).toBe(422); // the API's standard validation status
    expect(huge.headers()["cache-control"] ?? "").not.toMatch(/s-maxage/);

    const odd = await request.get(
      "/api/search/suggest?q=" + encodeURIComponent("'; DROP TABLE product;--"),
    );
    expect(odd.status()).toBe(200);
  });
});

// The open suggestion list on every kind of screen, in both directions and both themes: this is the part of the
// search UI the page-level audits cannot see (it only exists while the shopper types).
for (const locale of ["en", "ar"] as const) {
  for (const theme of ["dark", "light"] as const) {
    for (const [name, width, height] of [
      ["phone-320", 320, 568],
      ["tablet-768", 768, 1024],
      ["desktop-1280", 1280, 800],
    ] as const) {
      test(`open suggestions: ${locale} ${theme} ${name}`, async ({ browser, baseURL }) => {
        const context = await browser.newContext({
          viewport: { width, height },
          hasTouch: width < 1024,
          isMobile: width < 1024,
        });
        await context.addCookies([
          {
            name: "consent",
            value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ts: 1 })),
            url: baseURL ?? "http://localhost:3000",
          },
        ]);
        const page = await context.newPage();
        await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
        await page.goto(`/${locale}`);
        const input = box(page);
        await whenHydrated(input);
        await input.fill(locale === "ar" ? "كارت شاشة" : "rtx");
        const list = page.getByRole("listbox");
        await expect(list).toBeVisible();
        await expect(list.getByRole("option").first()).toBeVisible();

        // inside the viewport, never scrolling the page sideways
        const b = await list.boundingBox();
        expect(
          b && b.x >= -0.5 && b.x + b.width <= width + 0.5,
          `list at ${b?.x}+${b?.width}`,
        ).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
        ).toBe(true);
        // every option is a comfortable touch target
        for (const o of await list.getByRole("option").all()) {
          const ob = await o.boundingBox();
          expect(ob?.height ?? 0).toBeGreaterThanOrEqual(43.5);
        }
        // and the open list has no accessibility violations
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          results.violations.map(
            (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
          ),
        ).toEqual([]);
        await context.close();
      });
    }
  }
}
