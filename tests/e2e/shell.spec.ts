import { expect, test } from "./fixtures";
import { storeName } from "../../src/config/brand";
import { openDrawer, openMegaMenu, whenHydrated } from "./helpers";

const SECRET_FREE_STATUS = (overall: string, database = overall) => ({
  ok: true,
  data: {
    overall,
    components: { website: "operational", api: "operational", database },
    checkedAt: "2026-10-11T10:00:00.000Z",
  },
});

test.describe("desktop header", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("has the top bar, logo, wide search, account, wishlist, cart and the category row", async ({
    page,
  }) => {
    await page.goto("/en");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Help & support" })).toBeVisible();
    // No delivery or payment claim is hardcoded: the bar stays neutral until the owner sets StoreSetting "topbar".
    await expect(page.locator("[data-topbar]")).not.toContainText(
      /Cash on Delivery|governorate|free delivery/i,
    );
    await expect(header.getByRole("link", { name: storeName("en") }).first()).toBeVisible();
    await expect(header.getByRole("search")).toBeVisible();
    await expect(header.getByRole("link", { name: /Wishlist/ })).toBeVisible();
    await expect(header.getByRole("link", { name: /Account/ })).toBeVisible();
    await expect(header.getByRole("link", { name: /^Cart/ })).toBeVisible();
    await expect(header.getByRole("navigation", { name: "Product categories" })).toBeVisible();
    const search = await header.getByRole("searchbox").boundingBox();
    expect(
      search?.width ?? 0,
      "search should be the widest element of the main row",
    ).toBeGreaterThan(400);
  });

  test("hovering a category opens a full-width panel; a link inside navigates with breadcrumbs", async ({
    page,
  }) => {
    await page.goto("/en");
    await openMegaMenu(page, "Components");
    const gpu = page.getByRole("link", { name: "Graphics Cards", exact: true });
    await expect(gpu).toBeVisible();
    // Scoped to the menu: after navigating, "NVIDIA GeForce" is also a subcategory chip on the listing page.
    const menu = page.getByRole("navigation", { name: "Product categories" });
    await expect(menu.getByRole("link", { name: "NVIDIA GeForce" })).toBeVisible();
    await gpu.click();
    await expect(page).toHaveURL(/\/en\/c\/components\/graphics-cards$/);
    await expect(page.getByRole("heading", { level: 1, name: "Graphics Cards" })).toBeVisible();
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Components" })).toBeVisible();
    await expect(crumbs.getByText("Graphics Cards")).toHaveAttribute("aria-current", "page");
    // the panel closed after navigating
    await expect(menu.getByRole("link", { name: "NVIDIA GeForce" })).toBeHidden();
  });

  test("keyboard: Enter opens the panel, Escape closes it and returns focus to the trigger", async ({
    page,
  }) => {
    await page.goto("/en");
    const trigger = page.getByRole("button", { name: "Components" });
    await whenHydrated(trigger);
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: "Shop all Components" })).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: "Shop all Components" })).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the header stays on screen while scrolling; the top bar scrolls away", async ({ page }) => {
    await page.goto("/en/styleguide");
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(150);
    const search = page.getByRole("searchbox");
    const box = await search.boundingBox();
    expect(box && box.y >= 0 && box.y < 120, `search at y=${box?.y}`).toBe(true);
    const bar = await page.locator("[data-topbar]").boundingBox();
    expect(
      (bar?.y ?? 0) + (bar?.height ?? 0),
      "top bar should be above the viewport",
    ).toBeLessThanOrEqual(1);
    await expect(page.getByRole("button", { name: "Components" })).toBeInViewport();
  });

  test("search submits to the localized results route", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("searchbox").fill("rtx 4060");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/search\?q=rtx\+4060$/);
    await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();
  });

  test("Arabic: search goes to /ar/search and the layout mirrors", async ({ page }) => {
    await page.goto("/ar");
    await page.getByRole("searchbox").fill("معالج");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/ar\/search\?q=/);
    const logo = await page.locator("header a[href='/ar']").first().boundingBox();
    expect((logo?.x ?? 0) > 640, "logo sits on the right in RTL").toBe(true);
  });
});

test.describe("cart badge", () => {
  for (const [locale, label] of [
    ["en", "Cart, 3 items"],
    ["ar", "السلة، 3 منتجات"],
  ] as const) {
    test(`${locale}: shows the persisted count with an accessible name`, async ({ page }) => {
      await page.addInitScript(() =>
        localStorage.setItem(
          "cart",
          JSON.stringify({ state: { lines: { a: 2, b: 1 } }, version: 1 }),
        ),
      );
      await page.goto(`/${locale}`);
      await expect(page.getByTestId("cart-badge")).toHaveText("3");
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    });
  }
  test("no badge when the cart is empty, and 99+ is capped", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByTestId("cart-badge")).toHaveCount(0);
    await page.evaluate(() =>
      localStorage.setItem("cart", JSON.stringify({ state: { lines: { a: 250 } }, version: 1 })),
    );
    await page.reload();
    await expect(page.getByTestId("cart-badge")).toHaveText("99+");
  });
});

for (const locale of ["en", "ar"] as const) {
  test.describe(`mobile drawer (${locale})`, () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test("opens, traps focus, expands categories, navigates and closes", async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(
        page.getByRole("navigation", { name: /Product categories|فئات المنتجات/ }),
      ).toBeHidden(); // desktop row is hidden
      await openDrawer(page);
      const dialog = page.getByRole("dialog");

      // slides in from the inline START: left in LTR, right in RTL
      const box = await dialog.boundingBox();
      if (locale === "ar") expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThan(389);
      else expect(box?.x ?? 99).toBeLessThan(1);

      // focus stays inside the dialog
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press("Tab");
        expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(
          true,
        );
      }

      const components = dialog.getByRole("button", { name: /Components|المكونات/ });
      await components.click();
      await expect(components).toHaveAttribute("aria-expanded", "true");
      await dialog.getByRole("button", { name: /CPUs|المعالجات/ }).click();
      await dialog.getByRole("link", { name: /AMD Ryzen/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/c/components/cpus/amd-ryzen$`));
      await expect(dialog).toBeHidden(); // closed after navigating
    });

    test("Escape closes the drawer and returns focus to the menu button", async ({ page }) => {
      await page.goto(`/${locale}`);
      const menu = page.locator("header button[aria-haspopup=dialog]");
      await openDrawer(page);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(menu).toBeFocused();
    });

    test("language and theme controls live in the drawer on phones", async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator("[data-topbar]")).toBeHidden();
      await openDrawer(page);
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("link", { name: "English" })).toBeVisible();
      await expect(dialog.getByRole("group").getByRole("button")).toHaveCount(3);
    });

    test("the header is sticky with search reachable on a phone", async ({ page }) => {
      await page.goto(`/${locale}/styleguide`);
      await page.evaluate(() => window.scrollTo(0, 1500));
      await page.waitForTimeout(150);
      const box = await page.getByRole("searchbox").boundingBox();
      expect(box && box.y >= 0 && box.y < 160, `search at y=${box?.y}`).toBe(true);
    });
  });
}

test.describe("short landscape phone", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  test("the header is NOT sticky, so it never eats a third of the screen", async ({ page }) => {
    await page.goto("/en/styleguide");
    expect(await page.locator("header").evaluate((el) => getComputedStyle(el).position)).toBe(
      "static",
    );
  });
});

test.describe("cookie consent", () => {
  test.use({ consent: false });

  test("appears for a new visitor without moving focus, and Accept all records and hides it", async ({
    page,
    context,
  }) => {
    await page.goto("/en");
    const dialog = page.getByRole("dialog", { name: "Your privacy choices" });
    await expect(dialog).toBeVisible();
    expect(
      await page.evaluate(() => document.activeElement?.closest("[role=dialog]") === null),
    ).toBe(true);
    const accept = dialog.getByRole("button", { name: "Accept all" });
    await whenHydrated(accept);
    await accept.click();
    await expect(dialog).toBeHidden();
    const cookie = (await context.cookies()).find((c) => c.name === "consent");
    expect(JSON.parse(decodeURIComponent(cookie?.value ?? "{}"))).toMatchObject({
      v: 1,
      analytics: true,
    });
    expect(cookie?.sameSite).toBe("Lax");
    await page.reload();
    await expect(dialog).toBeHidden();
  });

  test("Reject non-essential records analytics=false; the footer reopens the settings", async ({
    page,
    context,
  }) => {
    await page.goto("/ar");
    const reject = page.getByRole("dialog").getByRole("button").nth(1);
    await whenHydrated(reject);
    await reject.click();
    const cookie = (await context.cookies()).find((c) => c.name === "consent");
    expect(JSON.parse(decodeURIComponent(cookie?.value ?? "{}")).analytics).toBe(false);

    const settings = page.getByRole("button", { name: "إعدادات ملفات الارتباط" });
    await whenHydrated(settings);
    await settings.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "خياراتك للخصوصية" })).toBeFocused();
    await dialog.getByRole("checkbox").nth(1).check();
    await dialog.getByRole("button", { name: "حفظ الاختيارات" }).click();
    const after = (await context.cookies()).find((c) => c.name === "consent");
    expect(JSON.parse(decodeURIComponent(after?.value ?? "{}")).analytics).toBe(true);
  });

  test("essential storage is always on and cannot be unchecked", async ({ page }) => {
    await page.goto("/en");
    const customize = page.getByRole("button", { name: "Customize" });
    await whenHydrated(customize);
    await customize.click();
    await expect(page.getByRole("checkbox", { name: "Essential" })).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: "Essential" })).toBeChecked();
  });
});

test.describe("footer", () => {
  for (const [overall, text] of [
    ["operational", "All systems operational"],
    ["degraded", "Some systems are degraded"],
    ["down", "Service disruption"],
  ] as const) {
    test(`status dot shows "${overall}" from the cached endpoint`, async ({ page }) => {
      await page.route("**/api/status", (route) =>
        route.fulfill({ json: SECRET_FREE_STATUS(overall) }),
      );
      await page.goto("/en");
      const dot = page.locator("footer [data-status]");
      await expect(dot).toHaveAttribute("data-status", overall);
      await expect(dot.getByRole("status")).toHaveText(text);
    });
  }

  test("status dot says unavailable (not broken) when the request fails, and links to /status", async ({
    page,
  }) => {
    await page.route("**/api/status", (route) => route.abort());
    await page.goto("/ar");
    const dot = page.locator("footer [data-status]");
    await expect(dot).toHaveAttribute("data-status", "unavailable");
    await expect(dot).toHaveAttribute("href", "/ar/status");
  });

  test("/api/status is public, cached, always 200, and exposes only coarse fields", async ({
    request,
  }) => {
    const res = await request.get("/api/status");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toMatch(/s-maxage=\d+/);
    const body = (await res.json()) as { ok: boolean; data: Record<string, unknown> };
    expect(Object.keys(body.data).sort()).toEqual(["checkedAt", "components", "overall"]);
    expect(Object.keys(body.data["components"] as object).sort()).toEqual([
      "api",
      "database",
      "website",
    ]);
    expect(["operational", "degraded", "down"]).toContain(body.data["overall"]);
    expect(JSON.stringify(body)).not.toMatch(/localhost|127\.0\.0\.1|postgres|password|latency/i);
  });

  test("has link groups, payment methods and the brand copyright", async ({ page }) => {
    await page.goto("/en");
    const footer = page.locator("footer");
    for (const heading of ["Shop", "Customer care", "Company"]) {
      await expect(footer.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expect(footer.getByText("Cash on Delivery", { exact: true })).toBeVisible();
    await expect(footer.getByText(/All rights reserved/)).toBeVisible();
    await expect(footer.getByText(new RegExp(`© ${new Date().getFullYear()}`))).toBeVisible();
  });
});

test("no dead links: every internal header, mega-menu and footer link resolves", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en");
  await openMegaMenu(page, "Components");
  await expect(page.getByRole("link", { name: "Shop all Components" })).toBeVisible();
  const hrefs = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLAnchorElement>("header a[href^='/'], footer a[href^='/']"),
    ].map((a) => a.getAttribute("href") ?? ""),
  );
  const unique = [...new Set(hrefs)].filter((h) => !h.startsWith("//"));
  expect(unique.length).toBeGreaterThan(30);
  const bad: string[] = [];
  for (const href of unique) {
    const status = (await request.get(href, { maxRedirects: 0 })).status();
    if (status !== 200) bad.push(`${href} -> ${status}`);
  }
  expect(bad).toEqual([]);
});

test("no console errors across the shell: menus, drawer, banner, locale switch", async ({
  page,
}) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`[${m.type()}] ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`[pageerror] ${e.message}`));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en");
  await openMegaMenu(page, "Components");
  await page.getByRole("link", { name: "CPUs", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/c\/components\/cpus$/); // wait for the navigation before the next click
  await page.getByRole("link", { name: "العربية" }).click();
  await expect(page).toHaveURL(/\/ar\/c\/components\/cpus$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await openDrawer(page);
  await page.keyboard.press("Escape");
  expect(problems).toEqual([]);
});

test.describe("sitemap and robots", () => {
  test("the sitemap lists real pages only, with hreflang alternates, and never a 'coming soon' placeholder", async ({
    request,
  }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("/en</loc>");
    expect(xml).toContain("/ar</loc>");
    expect(xml).toContain('hreflang="ar"');
    for (const placeholder of [
      "/cart",
      "/wishlist",
      "/account",
      "/search",
      "/contact",
      "/status",
      "/terms",
    ]) {
      expect(xml, placeholder).not.toContain(placeholder);
    }
    // ADR 0016/0017: clean category and product paths only, in every locale; never a filtered/sorted URL.
    expect(xml).toContain("/en/c/components/cpus</loc>");
    expect(xml).toContain("/ar/c/components/cpus</loc>");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? "");
    expect(locs.length).toBeGreaterThan(2);
    for (const loc of locs) expect(loc, "no query string in the sitemap").not.toContain("?");
    // Real product and bundle pages are listed, in both locales (the placeholder era is over).
    expect(xml).toContain("/en/p/nvidia-geforce-rtx-5080-founders-edition-16gb</loc>");
    expect(xml).toContain("/ar/p/budget-gaming-pc-ryzen-5-5600-rtx-4060</loc>");
    expect(locs.filter((l) => /\/p\//.test(l)).length).toBeGreaterThanOrEqual(2 * 80);
    // Gift Cards is inactive, so it never appears.
    expect(xml).not.toContain("/c/gift-cards");
  });
  test("robots.txt blocks the API and points at the sitemap", async ({ request }) => {
    const text = await (await request.get("/robots.txt")).text();
    expect(text).toMatch(/Disallow:\s*\/api\//);
    expect(text).toMatch(/Sitemap:\s*\S+\/sitemap\.xml/);
  });
  test("placeholder pages are noindex", async ({ page }) => {
    for (const placeholder of ["/en/cart"]) {
      await page.goto(placeholder);
      await expect(page.locator('meta[name="robots"]'), placeholder).toHaveAttribute(
        "content",
        /noindex/,
      );
    }
  });
  test("a clean category page is indexable (ADR 0016), a filtered one is not", async ({ page }) => {
    await page.goto("/en/c/components/cpus");
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await page.goto("/en/c/components/cpus?in_stock=1");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
