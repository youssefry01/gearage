import { describe, expect, it } from "vitest";
import { PLACEHOLDER_ROUTES, routes } from "@/config/routes";
import { locales } from "@/i18n/locales";
import { allCategoryTrails, categoryPath } from "@/features/navigation/categories";
import { buildSitemapEntries, INDEXABLE_PATHS } from "./sitemap";

describe("sitemap", () => {
  const entries = buildSitemapEntries("https://shop.example/");

  it("lists every locale of every indexable page, with hreflang alternates", () => {
    expect(entries.map((e) => e.url)).toEqual(locales.map((l) => `https://shop.example/${l}`));
    for (const e of entries) {
      expect(Object.keys(e.alternates.languages).sort()).toEqual([...locales].sort());
    }
  });

  it("never lists a 'coming soon' placeholder (they are noindex)", () => {
    const urls = new Set(entries.map((e) => new URL(e.url).pathname));
    for (const key of PLACEHOLDER_ROUTES) {
      for (const l of locales)
        expect(urls.has(`/${l}${routes[key]}`), `${l}${routes[key]}`).toBe(false);
    }
    for (const path of INDEXABLE_PATHS) {
      expect(PLACEHOLDER_ROUTES.map((k) => routes[k] as string)).not.toContain(path);
    }
  });

  it("never lists placeholder category pages until M3a serves real ones", () => {
    const urls = entries.map((e) => new URL(e.url).pathname);
    const placeholderCategory = new Set(allCategoryTrails().map((t) => categoryPath(t)));
    for (const u of urls) {
      expect(placeholderCategory.has(u.replace(/^\/[a-z-]+/, ""))).toBe(false);
    }
  });

  it("tolerates a trailing slash on the origin", () => {
    expect(buildSitemapEntries("https://a.example///")[0]?.url).toBe(
      `https://a.example/${locales[0]}`,
    );
  });
});
