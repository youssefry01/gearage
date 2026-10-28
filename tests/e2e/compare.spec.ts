import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { whenHydrated } from "./helpers";

// Needs the seeded catalog (CI seeds it; locally run `npm run db:seed` first).

const GPUS = "/en/c/components/graphics-cards";
const CPUS = "/en/c/components/cpus";
const GPU_A = "asus-dual-geforce-rtx-4060-oc-edition-8gb";
const GPU_B = "asus-prime-geforce-rtx-5070-oc-edition-12gb";
const RADEON = "gigabyte-radeon-rx-7600-gaming-oc-8gb";
const BUNDLE_A = "budget-gaming-pc-ryzen-5-5600-rtx-4060";
const BUNDLE_B = "high-end-gaming-pc-ryzen-7-7800x3d-rtx-5080";

/** Ticks "Compare" on the card with this slug (the checkbox sits inside the card's article). */
async function tick(page: Page, slug: string) {
  const card = page.locator("article", { has: page.locator(`a[href$="/p/${slug}"]`) });
  const box = card.getByTestId("compare-toggle");
  await whenHydrated(box);
  await box.check();
}

test.describe("compare", () => {
  test("ticking two cards fills the tray, and it opens a side-by-side table", async ({ page }) => {
    await page.goto(GPUS);
    await tick(page, GPU_A);
    await expect(page.getByTestId("compare-tray")).toBeVisible();
    await expect(page.getByTestId("compare-tray")).toContainText("Add one more product");
    await tick(page, GPU_B);
    await page.getByTestId("compare-open").click();
    await expect(page).toHaveURL(new RegExp(`/en/compare\\?p=${GPU_A},${GPU_B}`));
    await expect(page.getByTestId("compare-column")).toHaveCount(2);
    await expect(page.getByTestId("compare-title")).toContainText("Graphics Cards");
    await expect(page.getByTestId("compare-table").getByRole("row").first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByText(/Demo catalog/)).toBeVisible();
    // The price row differs between these two cards.
    await expect(
      page.locator('[data-testid="compare-row"][data-differs="true"]').first(),
    ).toBeVisible();
  });

  test("differences-only hides identical rows and can be turned off again", async ({ page }) => {
    await page.goto(`/en/compare?p=${GPU_A},${GPU_B}`);
    const all = await page.getByTestId("compare-row").count();
    await page.getByTestId("compare-diff-toggle").click();
    await expect(page).toHaveURL(/diff=1/);
    const some = await page.getByTestId("compare-row").count();
    expect(some).toBeLessThan(all);
    await expect(page.locator('[data-testid="compare-row"][data-differs="false"]')).toHaveCount(0);
    await page.getByTestId("compare-diff-toggle").click();
    await expect(page.getByTestId("compare-row")).toHaveCount(all);
  });

  test("an NVIDIA and an AMD graphics card can be compared (same spec family)", async ({
    page,
  }) => {
    await page.goto(GPUS);
    await tick(page, GPU_A);
    await tick(page, RADEON);
    await expect(page.getByTestId("compare-tray").getByTestId("compare-tray-remove")).toHaveCount(
      2,
    );
    await expect(page.getByTestId("compare-tray")).not.toContainText("same category");
  });

  test("refuses a product from another category, and a fifth product, and says why", async ({
    page,
  }) => {
    await page.goto(GPUS);
    await tick(page, GPU_A);
    await page.goto(CPUS);
    const box = page.getByTestId("compare-toggle").first();
    await whenHydrated(box);
    await box.click();
    await expect(page.getByTestId("compare-tray")).toContainText("same category");
    await expect(box).not.toBeChecked();
    await expect(page.getByTestId("compare-tray").getByTestId("compare-tray-remove")).toHaveCount(
      1,
    );

    await page.evaluate(() => localStorage.removeItem("compare"));
    await page.goto(GPUS);
    const boxes = page.getByTestId("compare-toggle");
    await whenHydrated(boxes.first());
    for (let i = 0; i < 4; i++) await boxes.nth(i).check();
    await expect(page.getByTestId("compare-tray").getByTestId("compare-tray-remove")).toHaveCount(
      4,
    );
    await boxes.nth(5).click();
    await expect(page.getByTestId("compare-tray")).toContainText("up to 4");
    await expect(boxes.nth(5)).not.toBeChecked();
  });

  test("bundles compare with bundles: parts rows and a compatibility row", async ({ page }) => {
    await page.goto(`/en/compare?p=${BUNDLE_A},${BUNDLE_B}`);
    await expect(page.getByTestId("compare-title")).toContainText("PC bundles");
    await expect(page.getByTestId("compare-column")).toHaveCount(2);
    await expect(page.getByRole("rowheader", { name: /Compatibility/ })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: /CPUs/i }).first()).toBeVisible();
    await expect(page.getByTestId("compare-table")).not.toContainText("Compatibility problem");
  });

  test("a part and a bundle in one URL: the other group is dropped, with a notice", async ({
    page,
  }) => {
    await page.goto(`/en/compare?p=${BUNDLE_A},${GPU_A}`);
    await expect(page.getByTestId("compare-column")).toHaveCount(1);
    await expect(page.getByTestId("compare-notices")).toContainText("left out");
  });

  test("removing a column updates the URL and the tray", async ({ page }) => {
    await page.goto(GPUS);
    await tick(page, GPU_A);
    await tick(page, GPU_B);
    await page.getByTestId("compare-open").click();
    await expect(page.getByTestId("compare-column")).toHaveCount(2);
    const remove = page.getByTestId("compare-remove").first();
    await whenHydrated(remove);
    await remove.click();
    await expect(page).toHaveURL(new RegExp(`p=${GPU_B}$`));
    await expect(page.getByTestId("compare-column")).toHaveCount(1);
    await expect(page.getByTestId("compare-tray").getByTestId("compare-tray-remove")).toHaveCount(
      1,
    );
  });

  test("the list survives a reload; /compare opens it; unknown products are dropped from it", async ({
    page,
  }) => {
    await page.goto(GPUS);
    await tick(page, GPU_A);
    await tick(page, GPU_B);
    await page.goto("/en/compare");
    await expect(page).toHaveURL(new RegExp(`/en/compare\\?p=${GPU_A},${GPU_B}`));
    await expect(page.getByTestId("compare-column")).toHaveCount(2);
    await page.evaluate(() =>
      localStorage.setItem(
        "compare",
        JSON.stringify({
          version: 1,
          state: {
            items: [
              {
                slug: "gone-product",
                group: "cat:components/graphics-cards",
                title: { en: "Gone", ar: "Gone" },
                image: null,
              },
            ],
          },
        }),
      ),
    );
    await page.goto("/en/compare?p=gone-product");
    await expect(page.getByTestId("compare-notices")).toContainText("no longer available");
    await expect(page.getByTestId("compare-empty")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("compare")))
      .toContain('"items":[]');
  });

  test("empty state explains how to start", async ({ page }) => {
    await page.goto("/en/compare");
    await expect(page.getByTestId("compare-empty")).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse products" })).toBeVisible();
  });

  test("Arabic: RTL table, Arabic labels", async ({ page }) => {
    await page.goto(`/ar/compare?p=${GPU_A},${GPU_B}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("compare-title")).toContainText("مقارنة");
    await expect(page.getByTestId("compare-column")).toHaveCount(2);
    await expect(page.getByRole("rowheader", { name: /السعر/ })).toBeVisible();
  });
});

test.describe("recently viewed", () => {
  test("a product page lists earlier products, never itself, and can be cleared", async ({
    page,
  }) => {
    await page.goto(`/en/p/${GPU_A}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("recently-viewed")))
      .toContain(GPU_A);
    await page.goto(`/en/p/${GPU_B}`);
    const shelf = page.locator("#recently-viewed");
    await expect(shelf).toBeVisible();
    await expect(shelf.locator(`a[href$="/p/${GPU_A}"]`).first()).toBeVisible();
    await expect(shelf.locator(`a[href$="/p/${GPU_B}"]`)).toHaveCount(0);
    await page.getByTestId("recently-viewed-clear").click();
    await expect(shelf).toHaveCount(0);
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("recently-viewed")))
      .toContain(GPU_B);
    await expect(page.locator("#recently-viewed")).toHaveCount(0);
  });

  test("the home page shows the shelf for a returning shopper; a first visit shows none", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("#recently-viewed")).toHaveCount(0);
    await page.goto(`/en/p/${GPU_A}`);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("recently-viewed")))
      .toContain(GPU_A);
    await page.goto("/en");
    await expect(page.locator("#recently-viewed")).toBeVisible();
  });

  test("tampered storage is ignored, and a hidden product is dropped from the list", async ({
    page,
  }) => {
    await page.goto("/en");
    await page.evaluate(() =>
      localStorage.setItem(
        "recently-viewed",
        JSON.stringify({
          version: 1,
          state: { slugs: ["<img src=x onerror=alert(1)>", "no-such-product", "bad slug"] },
        }),
      ),
    );
    await page.reload();
    await expect(page.locator("#recently-viewed")).toHaveCount(0);
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });
});

test("product page delivery note makes no coverage claim", async ({ page }) => {
  await page.goto(`/en/p/${GPU_A}`);
  await expect(page.getByText("We deliver across Egypt")).toHaveCount(0);
  await expect(page.getByText(/shown at checkout/)).toBeVisible();
});
