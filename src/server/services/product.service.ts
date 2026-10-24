import {
  analyzeBuild,
  roleOfCategoryPath,
  type BuildPart,
  type CompatibilityReport,
} from "@/domain/compatibility";
import { isValidSlug } from "@/domain/catalog";
import { cardSavings, parseListingParams } from "@/domain/listing";
import {
  buildSpecRows,
  partAvailability,
  summarizeBuild,
  type Bilingual,
  type BuildSummary,
  type PartAvailability,
  type SpecRow,
} from "@/domain/product-page";
import { parseVideoEmbed, type VideoEmbed } from "@/domain/embed";
import { quoteBundle, type BundlePricing, type BundleQuote } from "@/domain/pricing";
import { queryListing } from "@/server/repositories/listing.repository";
import {
  fetchBundleParts,
  fetchBundlePricing,
  fetchProductBySlug,
  fetchProductMedia,
  fetchPublicProductSlugs,
  type BundlePartRow,
  type ProductRow,
} from "@/server/repositories/product.repository";
import { publicImageUrl } from "@/server/storage/public-url";
import { getCategory, getSpecDefinitions } from "./category.service";
import { toCardData, type ProductCardData } from "./listing.service";

export type { ProductCardData };

/** Both languages, or null when neither exists; a language that is missing falls back to the other one. */
export function bilingual(en: string | null, ar: string | null): Bilingual | null {
  const e = en?.trim() || null;
  const a = ar?.trim() || null;
  if (!e && !a) return null;
  return { en: e ?? (a as string), ar: a ?? (e as string) };
}

export type PageImage = { url: string; alt: Bilingual; isSvg: boolean };

export type ShowcaseView =
  | {
      id: string;
      type: "IMAGE";
      image: PageImage | null;
      caption: Bilingual | null;
      credit: string | null;
    }
  | {
      id: string;
      type: "IMAGE_TEXT";
      image: PageImage | null;
      title: Bilingual | null;
      body: Bilingual | null;
      caption: Bilingual | null;
      credit: string | null;
    }
  | { id: string; type: "FEATURE"; title: Bilingual | null; body: Bilingual | null }
  | {
      id: string;
      type: "VIDEO";
      /** null = the stored URL is not on the allow-list; the block is not rendered. */
      embed: VideoEmbed | null;
      caption: Bilingual | null;
      credit: string | null;
    };

export type BundlePartView = {
  componentId: string;
  quantity: number;
  slug: string;
  sku: string;
  title: Bilingual;
  brand: Bilingual | null;
  linkable: boolean;
  unitPrice: number;
  lineTotal: number;
  image: PageImage | null;
  categoryPath: string;
  availability: PartAvailability;
  available: number;
};

export type ProductPage = {
  id: string;
  type: ProductRow["type"];
  slug: string;
  sku: string;
  mpn: string | null;
  modelName: string | null;
  title: Bilingual;
  shortDescription: Bilingual | null;
  description: Bilingual | null;
  seoTitle: Bilingual | null;
  seoDescription: Bilingual | null;
  brand: { slug: string; name: Bilingual } | null;
  condition: ProductRow["condition"];
  warrantyMonths: number;
  price: number;
  compareAtPrice: number | null;
  /** What the parts cost separately (bundles). */
  listTotal: number;
  /** Savings vs the compare-at price (parts) or vs the parts total (bundles), as the cards compute them. */
  savings: ReturnType<typeof cardSavings>;
  available: number | null;
  lowStockThreshold: number;
  categoryPath: string;
  /** Category trail for breadcrumbs; empty when the category tree has no entry (stale cache). */
  trail: { slug: string; path: string; name: Bilingual }[];
  images: PageImage[];
  showcase: ShowcaseView[];
  tags: { slug: string; name: Bilingual }[];
  specRows: SpecRow[];
  facts: {
    weightGrams: number | null;
    lengthMm: number | null;
    widthMm: number | null;
    heightMm: number | null;
  };
  bundle: {
    parts: BundlePartView[];
    quote: BundleQuote;
    compatibility: CompatibilityReport;
    summary: BuildSummary;
  } | null;
  /** Bundles that include this part (physical products only). */
  includedIn: ProductCardData[];
  related: ProductCardData[];
};

const toImage = (
  key: string,
  en: string | null,
  ar: string | null,
  fallback: Bilingual,
): PageImage => ({
  url: publicImageUrl(key),
  alt: bilingual(en, ar) ?? fallback,
  isSvg: key.toLowerCase().endsWith(".svg"),
});

function toPartView(r: BundlePartRow): BundlePartView {
  const title = { en: r.titleEn, ar: r.titleAr };
  return {
    componentId: r.componentId,
    quantity: r.quantity,
    slug: r.slug,
    sku: r.sku,
    title,
    brand: r.brandNameEn ? { en: r.brandNameEn, ar: r.brandNameAr ?? r.brandNameEn } : null,
    linkable: r.linkable,
    unitPrice: r.price,
    lineTotal: r.price * r.quantity,
    image: r.imageKey ? toImage(r.imageKey, r.imageAltEn, r.imageAltAr, title) : null,
    categoryPath: r.categoryPath,
    availability: partAvailability(r),
    available: r.available,
  };
}

function toPricing(b: NonNullable<Awaited<ReturnType<typeof fetchBundlePricing>>>): BundlePricing {
  if (b.bundlePricingMode === "DISCOUNT_PERCENT")
    return { mode: "DISCOUNT_PERCENT", bps: b.bundleDiscountBps ?? 0 };
  if (b.bundlePricingMode === "DISCOUNT_FIXED")
    return { mode: "DISCOUNT_FIXED", amount: b.bundleDiscountAmount ?? 0 };
  return { mode: "FIXED", price: b.price ?? 0 };
}

const RELATED_LIMIT = 4;

/** Same category first (most viewed, in stock first), then the parent category fills the row. Never the product itself. */
async function fetchRelated(
  categoryPath: string,
  excludeProductId: string,
): Promise<ProductCardData[]> {
  const filters = parseListingParams({});
  const ask = async (path: string, pageSize: number) =>
    (
      await queryListing({
        categoryPath: path,
        filters,
        specDefs: [],
        pageSize,
        withFacets: false,
        excludeProductId,
      })
    ).rows;
  const own = await ask(categoryPath, RELATED_LIMIT);
  if (own.length >= RELATED_LIMIT || !categoryPath.includes("/")) return own.map(toCardData);
  const parent = categoryPath.slice(0, categoryPath.lastIndexOf("/"));
  const wider = await ask(parent, RELATED_LIMIT * 3);
  const seen = new Set(own.map((r) => r.id));
  const merged = [...own, ...wider.filter((r) => !seen.has(r.id))].slice(0, RELATED_LIMIT);
  return merged.map(toCardData);
}

/**
 * Everything a product or bundle page needs. null = there is no visible product with this slug (draft, archived,
 * deleted, inactive category or brand, or never existed): the route answers 404.
 *
 * Statements: product row (1), media (3, parallel), spec definitions (cached), then for a bundle its parts (1) and
 * pricing (1), for a part its bundles (2), plus related products (2 to 4). All bounded; none per component.
 */
export async function getProductPage(slug: string): Promise<ProductPage | null> {
  if (!process.env.DATABASE_URL || !isValidSlug(slug)) return null;
  const row = await fetchProductBySlug(slug);
  if (!row) return null;

  const title = { en: row.titleEn, ar: row.titleAr };
  const isBundle = row.type === "BUNDLE";
  const [media, specDefs, found, partRows, pricing, includedIn, related] = await Promise.all([
    fetchProductMedia(row.id),
    isBundle ? Promise.resolve([]) : getSpecDefinitions(row.categoryPath),
    getCategory(row.categoryPath.split("/")),
    isBundle ? fetchBundleParts(row.id) : Promise.resolve([]),
    isBundle ? fetchBundlePricing(row.id) : Promise.resolve(null),
    isBundle
      ? Promise.resolve([])
      : queryListing({
          filters: parseListingParams({}),
          specDefs: [],
          pageSize: 6,
          withFacets: false,
          componentId: row.id,
        }).then((r) => r.rows.map(toCardData)),
    fetchRelated(row.categoryPath, row.id),
  ]);

  const parts = partRows.map(toPartView);
  let bundle: ProductPage["bundle"] = null;
  if (isBundle && pricing) {
    const quote = quoteBundle(
      toPricing(pricing),
      partRows.map((r) => ({ productId: r.componentId, quantity: r.quantity, unitPrice: r.price })),
    );
    const buildParts: BuildPart[] = partRows.flatMap((r) => {
      const role = roleOfCategoryPath(r.categoryPath);
      return role ? [{ role, quantity: r.quantity, specs: r.specs }] : [];
    });
    bundle = {
      parts,
      quote,
      compatibility: analyzeBuild(buildParts),
      summary: summarizeBuild(buildParts),
    };
  }

  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    sku: row.sku,
    mpn: row.mpn,
    modelName: row.modelName,
    title,
    shortDescription: bilingual(row.shortDescriptionEn, row.shortDescriptionAr),
    description: bilingual(row.descriptionEn, row.descriptionAr),
    seoTitle: bilingual(row.seoTitleEn, row.seoTitleAr),
    seoDescription: bilingual(row.seoDescriptionEn, row.seoDescriptionAr),
    brand: row.brandSlug
      ? {
          slug: row.brandSlug,
          name: {
            en: row.brandNameEn ?? row.brandSlug,
            ar: row.brandNameAr ?? row.brandNameEn ?? row.brandSlug,
          },
        }
      : null,
    condition: row.condition,
    warrantyMonths: row.warrantyMonths,
    price: row.effectivePrice,
    compareAtPrice: row.compareAtPrice,
    listTotal: row.listTotal,
    savings: cardSavings({
      type: row.type,
      effectivePrice: row.effectivePrice,
      listTotal: row.listTotal,
      compareAtPrice: row.compareAtPrice,
    }),
    available: row.available,
    lowStockThreshold: row.lowStockThreshold,
    categoryPath: row.categoryPath,
    trail: (found?.chain ?? []).map((n) => ({
      slug: n.slug,
      path: n.path,
      name: { en: n.name.en, ar: n.name.ar },
    })),
    images: media.images.map((i) => toImage(i.storageKey, i.altEn, i.altAr, title)),
    showcase: media.showcase.map((b): ShowcaseView => {
      const image = b.imageKey ? toImage(b.imageKey, b.imageAltEn, b.imageAltAr, title) : null;
      const caption = bilingual(b.captionEn, b.captionAr);
      const heading = bilingual(b.titleEn, b.titleAr);
      const body = bilingual(b.bodyEn, b.bodyAr);
      switch (b.type) {
        case "IMAGE":
          return { id: b.id, type: "IMAGE", image, caption, credit: b.credit };
        case "IMAGE_TEXT":
          return {
            id: b.id,
            type: "IMAGE_TEXT",
            image,
            title: heading,
            body,
            caption,
            credit: b.credit,
          };
        case "FEATURE":
          return { id: b.id, type: "FEATURE", title: heading, body };
        case "VIDEO":
          return {
            id: b.id,
            type: "VIDEO",
            embed: parseVideoEmbed(b.videoUrl),
            caption,
            credit: b.credit,
          };
      }
    }),
    tags: media.tags.map((t) => ({ slug: t.slug, name: { en: t.nameEn, ar: t.nameAr } })),
    specRows: isBundle ? [] : buildSpecRows(specDefs, row.specs),
    facts: {
      weightGrams: row.weightGrams,
      lengthMm: row.lengthMm,
      widthMm: row.widthMm,
      heightMm: row.heightMm,
    },
    bundle,
    includedIn,
    related,
  };
}

/** Slugs of every product a shopper can see (the sitemap). */
export const listPublicProductSlugs = (): Promise<string[]> =>
  process.env.DATABASE_URL ? fetchPublicProductSlugs() : Promise.resolve([]);
