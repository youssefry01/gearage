import type { CategoryNode } from "@/domain/category-tree";
import {
  type BrandStripEntry,
  HOME_FEATURED_POOL,
  HOME_RAIL_SIZE,
  type HomeRailKey,
  foldBrandStrip,
  pickHero,
  railFilters,
} from "@/domain/home";
import { fetchBrandCategoryCounts } from "@/server/repositories/home.repository";
import { queryListing } from "@/server/repositories/listing.repository";
import { fetchBundleParts } from "@/server/repositories/product.repository";
import { publicImageUrl } from "@/server/storage/public-url";
import { getCategoryTree } from "./category.service";
import { type Bilingual, type ProductCardData, toCardData } from "./listing.service";

export type HomeCategory = {
  slug: string;
  path: string;
  name: Bilingual;
  productCount: number;
  image: string | null;
};

export type HomeBrand = {
  slug: string;
  name: Bilingual;
  productCount: number;
  /** Top-level category path the brand is linked to (its strongest one), or null when none can be linked. */
  categoryPath: string | null;
};

export type HeroBundle = {
  product: ProductCardData;
  parts: { quantity: number; title: Bilingual }[];
};

export type HomeData = {
  categories: HomeCategory[];
  hero: HeroBundle | null;
  rails: Record<HomeRailKey, ProductCardData[]>;
  brands: HomeBrand[];
};

const emptyHome = (): HomeData => ({
  categories: [],
  hero: null,
  rails: { featured: [], deals: [], bestSellers: [], newArrivals: [], mostViewed: [] },
  brands: [],
});

const toHomeCategory = (c: CategoryNode): HomeCategory => ({
  slug: c.slug,
  path: c.path,
  name: c.name,
  productCount: c.productCount,
  image: c.imageKey ? publicImageUrl(c.imageKey) : null,
});

/** Rows for one rail. The featured rail fetches a larger pool (the hero bundle is picked from it). */
async function railRows(key: HomeRailKey): Promise<ProductCardData[]> {
  const result = await queryListing({
    filters: railFilters(key),
    specDefs: [],
    pageSize: key === "featured" ? HOME_FEATURED_POOL : HOME_RAIL_SIZE,
    withFacets: false,
  });
  return result.rows.map(toCardData);
}

/**
 * Everything the home page shows, from the database. Statements: the five rails (2 each: rows and total), brand
 * counts (1), and for the hero bundle its parts (1); the category tree is cached. All bounded by the section sizes,
 * none per product, brand or category.
 *
 * With no DATABASE_URL (the CI `verify` build) the page renders without sections. With one configured, a database
 * error propagates on purpose: the page is ISR, so a failed regeneration keeps serving the last good version rather
 * than caching an empty home page (same rule as the category tree).
 */
export async function getHomeData(): Promise<HomeData> {
  if (!process.env.DATABASE_URL) return emptyHome();

  const [tree, featuredPool, deals, bestSellers, newArrivals, mostViewed, brandRows] =
    await Promise.all([
      getCategoryTree(),
      railRows("featured"),
      railRows("deals"),
      railRows("bestSellers"),
      railRows("newArrivals"),
      railRows("mostViewed"),
      fetchBrandCategoryCounts(),
    ]);

  const { hero, rail: featured } = pickHero(featuredPool);
  const parts = hero ? await fetchBundleParts(hero.id) : [];

  const linkable = new Set(tree.map((c) => c.path));
  const names = new Map(
    brandRows.map((r) => [
      r.brandSlug,
      { en: r.brandNameEn, ar: r.brandNameAr ?? r.brandNameEn } satisfies Bilingual,
    ]),
  );
  const brands: HomeBrand[] = foldBrandStrip(brandRows, linkable).map(
    (e: BrandStripEntry): HomeBrand => ({
      slug: e.brandSlug,
      name: names.get(e.brandSlug) ?? { en: e.brandSlug, ar: e.brandSlug },
      productCount: e.total,
      categoryPath: e.topPath,
    }),
  );

  return {
    categories: tree.map(toHomeCategory),
    hero: hero
      ? {
          product: hero,
          parts: parts.map((p) => ({
            quantity: p.quantity,
            title: { en: p.titleEn, ar: p.titleAr },
          })),
        }
      : null,
    rails: { featured, deals, bestSellers, newArrivals, mostViewed },
    brands,
  };
}
