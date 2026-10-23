import { expect, test } from "./fixtures";

// Needs the seeded catalog (CI seeds it; locally run `npm run db:seed` first).

test.describe("category listing", () => {
  test("shows the category, products, breadcrumbs and the demo notice", async ({ page }) => {
    await page.goto("/en/c/components/cpus");
    await expect(page.getByRole("heading", { level: 1, name: "CPUs" })).toBeVisible();
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
    await expect(page.getByText(/Demo catalog/)).toBeVisible();
  });

  test("clean URL is indexable with hreflang; a sorted URL is noindex without hreflang", async ({
    page,
  }) => {
    await page.goto("/en/c/components/cpus");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/en\/c\/components\/cpus$/,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    await page.goto("/en/c/components/cpus?sort=price-asc&utm_source=x");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\?sort=price-asc$/,
    );
  });

  test("sorting updates the URL and the order of prices", async ({ page }) => {
    await page.goto("/en/c/components/cpus");
    await page.getByLabel("Sort by").selectOption("price-asc");
    await expect(page).toHaveURL(/sort=price-asc/);
    const prices = await page.getByTestId("product-card").evaluateAll((cards) =>
      cards.map((c) => {
        const text = c.querySelector("bdi")?.textContent ?? "";
        return Number(text.replace(/[^\d.]/g, ""));
      }),
    );
    expect(prices.length).toBeGreaterThan(1);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test("a filter shows a removable chip and the URL stays clean", async ({ page, isMobile }) => {
    test.skip(isMobile, "the sidebar is desktop-only; the drawer is covered below");
    await page.goto("/en/c/components/cpus");
    await page.getByLabel("In stock only").first().check();
    await expect(page).toHaveURL(/in_stock=1$/);
    const chip = page.getByRole("link", { name: /Remove filter: In stock only/ });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page).toHaveURL(/\/en\/c\/components\/cpus$/);
  });

  test("mobile: the Filters drawer applies a filter", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/en/c/components/cpus");
    await page.getByRole("button", { name: /^Filters/ }).click();
    const dialog = page.getByRole("dialog", { name: "Filter products" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("In stock only").check();
    await dialog.getByRole("button", { name: "Show results" }).click();
    await expect(page).toHaveURL(/in_stock=1/);
    await expect(dialog).toBeHidden();
  });

  test("zero results show the empty state and a way out", async ({ page }) => {
    await page.goto("/en/c/components/cpus?brand=nvidia");
    await expect(
      page.getByRole("heading", { name: "No products match your filters" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/en\/c\/components\/cpus$/);
    await expect(page.getByTestId("product-card").first()).toBeVisible();
  });

  test("numbered pagination uses crawlable links", async ({ page }) => {
    await page.goto("/en/c/components");
    const next = page.getByRole("link", { name: "Go to page 2" });
    await expect(next).toHaveAttribute("href", /\?page=2$/);
    await next.click();
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(page.getByRole("link", { name: "Go to page 1" })).toHaveAttribute(
      "href",
      /\/c\/components$/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\?page=2$/);
  });

  test("the language switch keeps the filters", async ({ page, isMobile }) => {
    test.skip(isMobile, "language links live in the drawer on phones");
    await page.goto("/en/c/components/cpus?in_stock=1");
    await page.getByRole("link", { name: "العربية" }).first().click();
    await expect(page).toHaveURL(/\/ar\/c\/components\/cpus\?in_stock=1$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("a bundle shows its badge and the 'you save' line", async ({ page }) => {
    await page.goto("/en/c/pc-bundles");
    const card = page.getByTestId("product-card").first();
    await expect(card.getByText("PC bundle")).toBeVisible();
    await expect(card.getByText(/parts?$/)).toBeVisible();
  });

  test("an unknown or inactive category is a real 404 with noindex and no products", async ({
    page,
    request,
  }) => {
    for (const path of ["/en/c/nope", "/en/c/gift-cards", "/en/c/components/nope"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByTestId("product-card"), path).toHaveCount(0);
    }
    // What a crawler receives: exactly one robots tag in the server HTML.
    const html = await (await request.get("/en/c/nope")).text();
    expect(html.match(/<meta name="robots"[^>]*>/g) ?? []).toHaveLength(1);
    // After hydration Next may add its own copy; every robots tag present must say noindex.
    const robots = await page
      .locator('meta[name="robots"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("content") ?? ""));
    expect(robots.length).toBeGreaterThan(0);
    for (const content of robots) expect(content).toContain("noindex");
  });

  test("a page number past the end is a real 404", async ({ page }) => {
    for (const path of ["/en/c/components/cpus?page=50", "/ar/c/components/cpus?page=50"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });
});
