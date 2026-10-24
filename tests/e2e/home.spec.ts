import { expect, test } from "./fixtures";

// Needs the seeded catalog (CI seeds it; locally run `npm run db:seed` first).

test.describe("home", () => {
  test("shows the hero, the featured bundle as a parts list, every shelf and the demo notice (en)", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Everything for your next PC build",
    );
    await expect(page.getByText(/Demo catalog/)).toBeVisible();

    const hero = page.getByTestId("hero-bundle");
    await expect(hero).toBeVisible();
    expect(await hero.getByRole("listitem").count()).toBeGreaterThan(2);
    await expect(hero.getByRole("link", { name: /View bundle/ })).toBeVisible();
    await expect(hero.getByText(/You save/)).toBeVisible();

    for (const name of [
      "Shop by category",
      "Deals",
      "Featured",
      "Best sellers",
      "New arrivals",
      "Most viewed",
      "Shop by brand",
    ])
      await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();

    expect(await page.getByTestId("category-tile").count()).toBeGreaterThanOrEqual(6);
    expect(await page.getByTestId("product-rail").count()).toBe(5);
    for (const rail of await page.getByTestId("product-rail").all())
      expect(await rail.getByTestId("product-card").count()).toBeGreaterThan(0);
    expect(await page.getByTestId("brand-chip").count()).toBeGreaterThan(5);
  });

  test("every category tile and brand chip opens a real page (no 404 from the front page)", async ({
    page,
    request,
  }) => {
    await page.goto("/en");
    const hrefs = await page
      .locator('[data-testid="category-tile"], [data-testid="brand-chip"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) {
      expect(href.startsWith("/en/c/"), href).toBe(true);
      expect((await request.get(href)).status(), href).toBe(200);
    }
  });

  test("a category tile navigates to its listing; a brand chip opens it filtered by that brand", async ({
    page,
  }) => {
    await page.goto("/en");
    const tile = page.getByTestId("category-tile").first();
    const tileHref = await tile.getAttribute("href");
    await tile.click();
    await expect(page).toHaveURL(new RegExp(`${tileHref}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/en");
    const chip = page.getByTestId("brand-chip").first();
    await chip.click();
    await expect(page).toHaveURL(/\?brand=/);
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    // A brand filter is a refined URL: noindex (ADR 0016).
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test('the "See deals" button jumps to the deals shelf', async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("link", { name: "See deals" }).click();
    await expect(page).toHaveURL(/#deals$/);
    await expect(page.locator("#deals")).toBeInViewport();
  });

  test("shelves never show an out-of-stock product", async ({ page }) => {
    await page.goto("/en");
    for (const rail of await page.getByTestId("product-rail").all())
      await expect(rail.getByText("Out of stock")).toHaveCount(0);
  });

  test("metadata: one self-canonical, hreflang, Organization and WebSite JSON-LD, no search action", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en$/);
    await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveCount(1);
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? "null")));
    const flat = blocks.flat() as { "@type": string; potentialAction?: unknown }[];
    expect(flat.map((b) => b["@type"])).toEqual(
      expect.arrayContaining(["Organization", "WebSite"]),
    );
    expect(flat.some((b) => b.potentialAction !== undefined)).toBe(false);
  });

  test("Arabic: right-to-left, Arabic copy and Arabic product names", async ({ page }) => {
    await page.goto("/ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "كل ما تحتاجه لتجميع جهازك القادم",
    );
    await expect(page.getByRole("heading", { level: 2, name: "الأكثر مبيعًا" })).toBeVisible();
    const title = await page.getByTestId("product-card").first().locator("h3").textContent();
    expect(title ?? "").toMatch(/[\u0600-\u06FF]/);
  });
});
