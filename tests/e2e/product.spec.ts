import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { whenHydrated } from "./helpers";

// Needs the seeded catalog (CI seeds it; locally run `npm run db:seed` first).

const PART = "nvidia-geforce-rtx-5080-founders-edition-16gb"; // low stock, 3 showcase blocks incl. a video
const DISCOUNTED = "amd-ryzen-5-7600-processor"; // has a compare-at price
const SOLD_OUT = "gigabyte-radeon-rx-7600-gaming-oc-8gb";
const BUNDLE = "budget-gaming-pc-ryzen-5-5600-rtx-4060";
const SHORT_BUNDLE = "high-end-gaming-pc-ryzen-7-7800x3d-rtx-5080";

const jsonLd = async (page: Page) =>
  (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
    (t) => JSON.parse(t) as Record<string, unknown>,
  );

test.describe("product page", () => {
  test("shows title, price, stock, specs, showcase and breadcrumbs", async ({ page }) => {
    const res = await page.goto(`/en/p/${PART}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("RTX 5080");
    await expect(page.getByTestId("product-price")).toContainText("EGP");
    await expect(page.getByTestId("stock-status")).toContainText("Only 2 left");
    await expect(page.getByTestId("specs-table")).toBeVisible();
    await expect(page.getByTestId("specs-table").getByRole("row").first()).toBeVisible();
    await expect(page.getByTestId("showcase")).toBeVisible();
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Graphics Cards" })).toBeVisible();
    await expect(crumbs.getByText("RTX 5080", { exact: false })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByText(/Demo catalog/)).toBeVisible();
  });

  test("is indexable with canonical, hreflang and a product Open Graph title", async ({ page }) => {
    await page.goto(`/en/p/${PART}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/en/p/${PART}$`),
    );
    await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveAttribute(
      "href",
      new RegExp(`/ar/p/${PART}$`),
    );
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /RTX 5080/);
  });

  test("structured data: Product (no offer while the catalog is demo) and BreadcrumbList", async ({
    page,
  }) => {
    await page.goto(`/en/p/${PART}`);
    const blocks = await jsonLd(page);
    const product = blocks.find((b) => b["@type"] === "Product");
    const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList");
    expect(product).toMatchObject({ "@context": "https://schema.org", sku: expect.any(String) });
    // Illustrative prices are never published as structured data, and no rating is ever invented.
    expect(product).not.toHaveProperty("offers");
    expect(JSON.stringify(blocks)).not.toMatch(/aggregateRating/);
    const items = (crumbs?.itemListElement ?? []) as {
      position: number;
      name: string;
      item?: string;
    }[];
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.at(-1)?.item).toMatch(new RegExp(`/en/p/${PART}$`));
  });

  test("a discounted part shows the old price, percent off and the saving", async ({ page }) => {
    await page.goto(`/en/p/${DISCOUNTED}`);
    await expect(page.getByText(/% off/)).toBeVisible();
    await expect(page.getByTestId("product-savings")).toContainText("You save");
  });

  test("a sold-out part cannot be added to the cart", async ({ page }) => {
    await page.goto(`/en/p/${SOLD_OUT}`);
    await expect(page.getByTestId("stock-status")).toContainText("Out of stock");
    await expect(page.getByTestId("add-to-cart")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Currently unavailable" })).toBeDisabled();
  });

  test("adding to the cart updates the header badge and offers at most the stock on hand", async ({
    page,
  }) => {
    await page.goto(`/en/p/${PART}`);
    const qty = page.getByLabel("Quantity");
    // Stock is 2: the picker offers 1 and 2 only.
    await expect(qty.locator("option")).toHaveCount(2);
    const add = page.getByTestId("add-to-cart");
    await whenHydrated(add);
    await qty.selectOption("2");
    await add.click();
    await expect(page.getByRole("status").filter({ hasText: "added to your cart" })).toBeVisible();
    await expect(page.getByTestId("cart-badge")).toHaveText("2");
    // The cart already holds the maximum: another click is refused, not silently inflated.
    await add.click();
    await expect(page.getByText(/already have the maximum/)).toBeVisible();
    await expect(page.getByTestId("cart-badge")).toHaveText("2");
  });

  test("gallery: thumbnails switch the image and the viewer opens, navigates and closes", async ({
    page,
  }) => {
    await page.goto(`/en/p/${PART}`);
    const main = page.getByTestId("gallery-main");
    const first = await main.getAttribute("src");
    const thumb = page.getByRole("button", { name: /Show image 2 of/ });
    await whenHydrated(thumb);
    await thumb.click();
    await expect(thumb).toHaveAttribute("aria-current", "true");
    await expect(main).not.toHaveAttribute("src", first ?? "");

    const enlarge = page.getByRole("button", { name: "Enlarge image" });
    await enlarge.click();
    const viewer = page.getByRole("dialog");
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole("status")).toContainText("Image 2 of");
    await page.keyboard.press("ArrowRight");
    await expect(viewer.getByRole("status")).toContainText("Image 1 of");
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
    await expect(enlarge).toBeFocused();
  });

  test("showcase video loads from YouTube only after pressing play", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (r) => requested.push(r.url()));
    await page.goto(`/en/p/${PART}`);
    await expect(page.locator("iframe")).toHaveCount(0);
    expect(requested.some((u) => u.includes("youtube"))).toBe(false);
    const play = page.getByRole("button", { name: /Play video/ });
    await whenHydrated(play);
    await play.click();
    await expect(page.locator("iframe")).toHaveAttribute(
      "src",
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}/,
    );
  });

  test("a part lists the bundles it is included in", async ({ page }) => {
    await page.goto(`/en/p/${PART}`);
    await expect(page.getByRole("heading", { name: "Included in these bundles" })).toBeVisible();
  });

  test("related products never include the product itself", async ({ page }) => {
    await page.goto(`/en/p/${PART}`);
    const related = page
      .getByRole("region")
      .filter({ has: page.getByRole("heading", { name: "You may also like" }) });
    await expect(related.getByTestId("product-card").first()).toBeVisible();
    await expect(related.getByRole("link", { name: /RTX 5080 Founders Edition/ })).toHaveCount(0);
  });

  test("Arabic: RTL, translated labels, Western digits in the price", async ({ page }) => {
    await page.goto(`/ar/p/${PART}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "المواصفات" })).toBeVisible();
    await expect(page.getByRole("button", { name: "أضف إلى السلة" })).toBeVisible();
    await expect(page.getByTestId("product-price")).toContainText(/\d/);
    await expect(page.getByTestId("product-price")).not.toContainText(/[٠-٩]/);
  });

  test("unknown, malformed and out-of-catalog slugs answer 404", async ({ page }) => {
    for (const slug of ["no-such-product", "Not_A_Slug"]) {
      const res = await page.goto(`/en/p/${slug}`);
      expect(res?.status(), slug).toBe(404);
    }
  });
});

test.describe("bundle page", () => {
  test("shows the parts table with links, a real saving and a verified compatibility badge", async ({
    page,
  }) => {
    await page.goto(`/en/p/${BUNDLE}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Budget Gaming PC");
    const rows = page.getByTestId("bundle-part");
    expect(await rows.count()).toBeGreaterThanOrEqual(5);
    await expect(rows.first().getByRole("link")).toBeVisible();
    await expect(page.getByTestId("bundle-saving")).toContainText("EGP");
    await expect(page.getByTestId("product-savings")).toContainText("You save");
    const badge = page.getByTestId("compat-badge");
    await expect(badge).toHaveAttribute("data-status", /^(ok|notes)$/);
    await expect(badge).not.toContainText("Compatibility problem");
    await expect(page.getByText("At a glance")).toBeVisible();
  });

  test("a part's link opens that part's own page", async ({ page }) => {
    await page.goto(`/en/p/${BUNDLE}`);
    const link = page.getByTestId("bundle-part").first().getByRole("link");
    const name = (await link.textContent())?.trim() ?? "";
    await link.click();
    await expect(page).toHaveURL(/\/en\/p\//);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  });

  test("bundle structured data is a Product too, and the page is indexable", async ({ page }) => {
    await page.goto(`/en/p/${BUNDLE}`);
    expect((await jsonLd(page)).some((b) => b["@type"] === "Product")).toBe(true);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test("low bundle stock is shown and the picker is capped by it", async ({ page }) => {
    await page.goto(`/en/p/${SHORT_BUNDLE}`);
    await expect(page.getByTestId("stock-status")).toContainText("Only 2 left");
    await expect(page.getByLabel("Quantity").locator("option")).toHaveCount(2);
  });

  test("Arabic bundle page: RTL table and translated compatibility text", async ({ page }) => {
    await page.goto(`/ar/p/${BUNDLE}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("compat-badge")).toContainText(/توافق/);
    await expect(page.getByRole("columnheader", { name: "القطعة" })).toBeVisible();
  });
});
