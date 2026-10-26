import { type ListingFilters, type Sort, DEFAULT_SORT, listingQuery } from "@/domain/listing";

/**
 * Home page rules, pure so they are tested without a database or a browser (ADR 0018).
 *
 * Every product rail is "what a shopper can buy today": in stock only (an out-of-stock best seller on the front page
 * is a dead end). Rails are NOT de-duplicated against each other, because a rail's name is a claim ("Best sellers"
 * must be the real best sellers); only the hero bundle is taken out of the Featured rail it came from.
 */
export const HOME_RAIL_SIZE = 8;
/** Featured products fetched to find a hero bundle among them, and to fill the Featured rail after it. */
export const HOME_FEATURED_POOL = 12;
export const HOME_BRAND_LIMIT = 14;
/** The editorial tag that marks a product as featured (seed tag; admin-editable from M10a). */
export const FEATURED_TAG = "featured";

export type HomeRailKey = "featured" | "deals" | "bestSellers" | "newArrivals" | "mostViewed";

/** Display order on the page. */
export const HOME_RAILS: readonly HomeRailKey[] = [
  "deals",
  "featured",
  "bestSellers",
  "newArrivals",
  "mostViewed",
];

type RailSpec = { sort: Sort; tag?: string; onSale?: boolean };

/**
 * How each rail is selected. `mostViewed` uses the "popular" sort, which already orders by view count (in-stock
 * first, then views, then units sold); with the in-stock filter that is exactly "most viewed".
 */
export const RAIL_SPECS: Readonly<Record<HomeRailKey, RailSpec>> = {
  featured: { sort: "popular", tag: FEATURED_TAG },
  deals: { sort: "discount", onSale: true },
  bestSellers: { sort: "best-selling" },
  newArrivals: { sort: "newest" },
  mostViewed: { sort: DEFAULT_SORT },
};

export function railFilters(key: HomeRailKey): ListingFilters {
  const spec = RAIL_SPECS[key];
  return {
    brands: [],
    tags: spec.tag ? [spec.tag] : [],
    inStock: true,
    onSale: spec.onSale === true,
    specs: {},
    sort: spec.sort,
    page: 1,
  };
}

/**
 * Query string of a rail's "view all" link on the search results page (no search term: the all-products view). It is
 * the rail's own filters, so the first products of that page are exactly the rail (a DB test checks it).
 */
export const railViewAllQuery = (key: HomeRailKey): string => listingQuery(railFilters(key));

/**
 * The hero shows one featured bundle (a bundle is the most characteristic thing the store sells: a parts list at one
 * price). The first featured bundle in popularity order wins; it is removed from the rail so it is not shown twice.
 * With no featured bundle there is no hero panel and the rail keeps everything.
 */
export function pickHero<T extends { id: string; type: string }>(
  featured: readonly T[],
  railSize: number = HOME_RAIL_SIZE,
): { hero: T | null; rail: T[] } {
  const hero = featured.find((p) => p.type === "BUNDLE") ?? null;
  const rest = hero ? featured.filter((p) => p.id !== hero.id) : [...featured];
  return { hero, rail: rest.slice(0, railSize) };
}

export type BrandCategoryCount = {
  brandSlug: string;
  /** First segment of the category path ("components" for "components/gpus"). */
  topPath: string;
  count: number;
};

export type BrandStripEntry = { brandSlug: string; total: number; topPath: string | null };

/**
 * One entry per brand: its visible product total, and the top-level category it sells most in (the strip links to
 * that category filtered by the brand; there are no brand pages yet). `linkable` limits the choice to categories that
 * exist in the storefront tree, so a link can never point at a 404. Ties go to the alphabetically first path.
 * Sorted by total descending, then slug.
 */
export function foldBrandStrip(
  rows: readonly BrandCategoryCount[],
  linkable: ReadonlySet<string>,
  limit: number = HOME_BRAND_LIMIT,
): BrandStripEntry[] {
  const byBrand = new Map<string, { total: number; best: BrandCategoryCount | null }>();
  for (const r of rows) {
    const entry = byBrand.get(r.brandSlug) ?? { total: 0, best: null };
    entry.total += r.count;
    if (linkable.has(r.topPath)) {
      const b = entry.best;
      if (!b || r.count > b.count || (r.count === b.count && r.topPath < b.topPath)) entry.best = r;
    }
    byBrand.set(r.brandSlug, entry);
  }
  return [...byBrand.entries()]
    .map(([brandSlug, e]) => ({
      brandSlug,
      total: e.total,
      topPath: e.best?.topPath ?? null,
    }))
    .sort((a, b) => b.total - a.total || (a.brandSlug < b.brandSlug ? -1 : 1))
    .slice(0, limit);
}
