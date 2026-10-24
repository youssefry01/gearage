import { productHref } from "@/domain/catalog";
import { type CategoryNode, allCategoryPaths, categoryHref } from "@/domain/category-tree";
import { locales } from "@/i18n/locales";

/**
 * Locale-less paths of pages that REALLY exist and are indexable. "Coming soon" placeholders (config/routes.ts,
 * placeholder categories) are noindex and must never be listed here. When a milestone ships a real page, add its path
 * (or its generator) in the same change: categories (M3a) come from the database via categorySitemapPaths; products (M3b) from listPublicProductSlugs via productSitemapPaths.
 */
export const INDEXABLE_PATHS: readonly string[] = [""];

/** Locale-less URL paths of the category listing pages (clean URLs only: filtered and sorted URLs are noindex, ADR 0016). */
export const categorySitemapPaths = (tree: readonly CategoryNode[]): string[] =>
  allCategoryPaths(tree).map(categoryHref);

/** Locale-less URL paths of product and bundle pages. */
export const productSitemapPaths = (slugs: readonly string[]): string[] => slugs.map(productHref);

export type SitemapEntry = { url: string; alternates: { languages: Record<string, string> } };

/** One entry per locale and path, each carrying hreflang alternates for every locale. */
export function buildSitemapEntries(
  origin: string,
  paths: readonly string[] = INDEXABLE_PATHS,
): SitemapEntry[] {
  const base = origin.replace(/\/+$/, "");
  return paths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${base}/${l}${path}`])) },
    })),
  );
}
