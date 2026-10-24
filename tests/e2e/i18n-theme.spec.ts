import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { whenHydrated } from "./helpers";
import { brand, localized, storeName } from "../../src/config/brand";

test.describe("locale routing (ADR 0006)", () => {
  test("/ negotiates Accept-Language and falls back to English", async ({ request }) => {
    const ar = await request.get("/", {
      headers: { "accept-language": "ar-EG,ar;q=0.9,en;q=0.5" },
      maxRedirects: 0,
    });
    expect(ar.status()).toBeGreaterThanOrEqual(300);
    expect(ar.headers()["location"]).toMatch(/\/ar$/);

    const fr = await request.get("/", { headers: { "accept-language": "fr-FR" }, maxRedirects: 0 });
    expect(fr.headers()["location"]).toMatch(/\/en$/);

    const none = await request.get("/", { maxRedirects: 0 });
    expect(none.headers()["location"]).toMatch(/\/en$/);
  });

  test("the NEXT_LOCALE cookie wins over Accept-Language", async ({ request }) => {
    const res = await request.get("/", {
      headers: { "accept-language": "en-US", cookie: "NEXT_LOCALE=ar" },
      maxRedirects: 0,
    });
    expect(res.headers()["location"]).toMatch(/\/ar$/);
  });

  test("language switcher navigates and remembers the choice", async ({ page, context }) => {
    await page.goto("/en");
    await page.getByRole("link", { name: "العربية" }).click();
    await expect(page).toHaveURL(/\/ar$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect((await context.cookies()).find((c) => c.name === "NEXT_LOCALE")?.value).toBe("ar");
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en$/);
  });
});

test.describe("SEO and branding", () => {
  for (const locale of ["en", "ar"] as const) {
    test(`${locale}: title, hreflang, canonical and OG come from the brand config`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      await expect(page).toHaveTitle(
        `${storeName(locale)} | ${localized(brand.seo.title, locale)}`,
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        new RegExp(`/${locale}$`),
      );
      for (const l of ["en", "ar", "x-default"]) {
        await expect(page.locator(`link[rel="alternate"][hreflang="${l}"]`)).toHaveCount(1);
      }
      await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
        "content",
        storeName(locale),
      );
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        /\/brand\/og-default\.png$/,
      );
      await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
        "content",
        /\/brand\/og-default\.png$/,
      );
      await expect(page.locator('link[rel="icon"]').first()).toBeAttached();
      // The page's h1 is its headline; the store name is on the header logo link.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.locator("header").getByRole("link", { name: storeName(locale) }),
      ).toBeVisible();
    });
  }

  test("unknown URLs render the localized 404 with status 404", async ({ page }) => {
    const en = await page.goto("/en/definitely-not-a-page");
    expect(en?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
    const ar = await page.goto("/ar/definitely-not-a-page");
    expect(ar?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("الصفحة غير موجودة");
  });

  test("health endpoint is untouched by locale routing", async ({ request }) => {
    expect((await request.get("/api/health")).status()).toBe(200);
  });
});

test.describe("fonts", () => {
  const loadedFamilies = (page: Page) =>
    page.evaluate(() =>
      [...document.fonts]
        .filter((f) => f.status === "loaded")
        .map((f) => f.family.replaceAll('"', "")),
    );

  test("self-hosted IBM Plex Sans (Latin) and IBM Plex Sans Arabic load where their glyphs are used", async ({
    page,
  }) => {
    await page.goto("/ar");
    await page.evaluate(() => document.fonts.ready);
    const ar = await loadedFamilies(page);
    expect(ar).toContain("IBM Plex Sans Arabic");

    await page.goto("/en");
    await page.evaluate(() => document.fonts.ready);
    expect(await loadedFamilies(page)).toContain("IBM Plex Sans");
  });

  test("no request goes to Google Fonts", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url());
    });
    await page.goto("/ar");
    await page.evaluate(() => document.fonts.ready);
    expect(external).toEqual([]);
  });
});

test.describe("theme", () => {
  test("defaults to dark, switches, persists across reloads and swaps the logo artwork", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("header img.logo-on-dark")).toBeVisible();
    await expect(page.locator("header img.logo-on-light")).toBeHidden();

    const light = page.getByRole("button", { name: "Light" });
    await whenHydrated(light);
    await light.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Light" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("header img.logo-on-light")).toBeVisible();
    await expect(page.locator("header img.logo-on-dark")).toBeHidden();

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Light" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("'system' follows the OS color scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en");
    const system = page.getByRole("button", { name: "System" });
    await whenHydrated(system);
    await system.click();
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await bg()).toBe("rgb(255, 255, 255)");
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await bg()).toBe("rgb(13, 17, 20)");
  });

  test("keyboard: skip link is first and works", async ({ page }) => {
    await page.goto("/en");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });
});
