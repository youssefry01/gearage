import { describe, expect, it } from "vitest";
import { PLACEHOLDER_ROUTES, routes } from "@/config/routes";
import { locales } from "@/i18n/locales";
import type { CategoryNode } from "@/domain/category-tree";
import { buildSitemapEntries, categorySitemapPaths, INDEXABLE_PATHS } from "./sitemap";

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

  it("lists clean category URLs from the database tree, in every locale, and nothing with a query string", () => {
    const node = (path: string, children: CategoryNode[] = []): CategoryNode => ({
      id: path,
      slug: path.split("/").at(-1) ?? path,
      path,
      depth: path.split("/").length,
      name: { en: path, ar: path },
      description: { en: null, ar: null },
      seoTitle: { en: null, ar: null },
      seoDescription: { en: null, ar: null },
      imageKey: null,
      productCount: 1,
      children,
    });
    const tree = [node("components", [node("components/cpus")]), node("monitors")];
    const paths = categorySitemapPaths(tree);
    expect(paths).toEqual(["/c/components", "/c/components/cpus", "/c/monitors"]);
    const urls = buildSitemapEntries("https://shop.example", paths).map((e) => e.url);
    expect(urls).toHaveLength(paths.length * locales.length);
    expect(urls.every((u) => !u.includes("?"))).toBe(true);
    expect(urls).toContain("https://shop.example/ar/c/components/cpus");
  });

  it("tolerates a trailing slash on the origin", () => {
    expect(buildSitemapEntries("https://a.example///")[0]?.url).toBe(
      `https://a.example/${locales[0]}`,
    );
  });
});
