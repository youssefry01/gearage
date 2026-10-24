import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import { VISIBLE_PRODUCT } from "./visibility";

type Db = ReturnType<typeof getDb>;

export type ProductRow = {
  id: string;
  type: "PHYSICAL" | "BUNDLE" | "GIFT_CARD" | "DIGITAL";
  slug: string;
  sku: string;
  mpn: string | null;
  modelName: string | null;
  titleEn: string;
  titleAr: string;
  shortDescriptionEn: string | null;
  shortDescriptionAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  condition: "NEW" | "REFURBISHED";
  compareAtPrice: number | null;
  lowStockThreshold: number;
  warrantyMonths: number;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  specs: Record<string, unknown>;
  seoTitleEn: string | null;
  seoTitleAr: string | null;
  seoDescriptionEn: string | null;
  seoDescriptionAr: string | null;
  categoryPath: string;
  effectivePrice: number;
  listTotal: number;
  /** null = not stock-tracked. */
  available: number | null;
  brandSlug: string | null;
  brandNameEn: string | null;
  brandNameAr: string | null;
};

/** The visible product with this slug (shared visibility rule), with price and availability from the views: one statement. */
export async function fetchProductBySlug(
  slug: string,
  db: Db = getDb(),
): Promise<ProductRow | null> {
  const rows = await db.$queryRaw<ProductRow[]>`
    SELECT p."id", p."type", p."slug", p."sku", p."mpn", p."modelName",
           p."titleEn", p."titleAr", p."shortDescriptionEn", p."shortDescriptionAr",
           p."descriptionEn", p."descriptionAr", p."condition", p."compareAtPrice", p."lowStockThreshold",
           p."warrantyMonths", p."weightGrams", p."lengthMm", p."widthMm", p."heightMm", p."specs",
           p."seoTitleEn", p."seoTitleAr", p."seoDescriptionEn", p."seoDescriptionAr",
           cat."path" AS "categoryPath",
           pr."effectivePrice"::int AS "effectivePrice", pr."listTotal"::int AS "listTotal",
           av."available"::int AS "available",
           b."slug" AS "brandSlug", b."nameEn" AS "brandNameEn", b."nameAr" AS "brandNameAr"
    FROM "product" p
    JOIN "category" cat ON cat."id" = p."categoryId"
    JOIN "product_pricing" pr ON pr."productId" = p."id"
    JOIN "product_availability" av ON av."productId" = p."id"
    LEFT JOIN "brand" b ON b."id" = p."brandId"
    WHERE p."slug" = ${slug} AND ${VISIBLE_PRODUCT}
    LIMIT 1`;
  return rows[0] ?? null;
}

export type ImageRow = {
  storageKey: string;
  altEn: string;
  altAr: string;
  width: number | null;
  height: number | null;
};

export type ShowcaseRow = {
  id: string;
  type: "IMAGE" | "IMAGE_TEXT" | "FEATURE" | "VIDEO";
  imageKey: string | null;
  imageAltEn: string | null;
  imageAltAr: string | null;
  titleEn: string | null;
  titleAr: string | null;
  bodyEn: string | null;
  bodyAr: string | null;
  captionEn: string | null;
  captionAr: string | null;
  videoUrl: string | null;
  credit: string | null;
};

export type TagRow = { slug: string; nameEn: string; nameAr: string };

/** Images, showcase blocks and tags of one product: three small indexed reads, run in parallel. */
export async function fetchProductMedia(productId: string, db: Db = getDb()) {
  const [images, showcase, tags] = await Promise.all([
    db.productImage.findMany({
      where: { productId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { storageKey: true, altEn: true, altAr: true, width: true, height: true },
    }),
    db.showcaseBlock.findMany({
      where: { productId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        type: true,
        imageKey: true,
        imageAltEn: true,
        imageAltAr: true,
        titleEn: true,
        titleAr: true,
        bodyEn: true,
        bodyAr: true,
        captionEn: true,
        captionAr: true,
        videoUrl: true,
        credit: true,
      },
    }),
    db.productTag.findMany({
      where: { productId },
      orderBy: { tag: { slug: "asc" } },
      select: { tag: { select: { slug: true, nameEn: true, nameAr: true } } },
    }),
  ]);
  return {
    images: images satisfies ImageRow[],
    showcase: showcase satisfies ShowcaseRow[],
    tags: tags.map((t) => t.tag) satisfies TagRow[],
  };
}

export type BundlePartRow = {
  componentId: string;
  quantity: number;
  slug: string;
  sku: string;
  titleEn: string;
  titleAr: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  deleted: boolean;
  /** The part's own page is visible to shoppers (so the table may link to it). */
  linkable: boolean;
  price: number;
  specs: Record<string, unknown>;
  categoryPath: string;
  /** Whole units of THIS part in stock (not divided by quantity). */
  available: number;
  brandNameEn: string | null;
  brandNameAr: string | null;
  imageKey: string | null;
  imageAltEn: string | null;
  imageAltAr: string | null;
};

/** Every component of a bundle with price, specs, stock, brand, first image and link-ability: one statement, no N+1. */
export async function fetchBundleParts(
  bundleId: string,
  db: Db = getDb(),
): Promise<BundlePartRow[]> {
  return db.$queryRaw<BundlePartRow[]>`
    SELECT bi."componentId", bi."quantity", p."slug", p."sku", p."titleEn", p."titleAr", p."status",
           (p."deletedAt" IS NOT NULL) AS deleted,
           (${VISIBLE_PRODUCT}) AS "linkable",
           p."price", p."specs", cat."path" AS "categoryPath",
           COALESCE(av."available", 0)::int AS available,
           b."nameEn" AS "brandNameEn", b."nameAr" AS "brandNameAr",
           img."storageKey" AS "imageKey", img."altEn" AS "imageAltEn", img."altAr" AS "imageAltAr"
    FROM "bundle_item" bi
    JOIN "product" p ON p."id" = bi."componentId"
    JOIN "category" cat ON cat."id" = p."categoryId"
    LEFT JOIN "brand" b ON b."id" = p."brandId"
    LEFT JOIN "product_availability" av ON av."productId" = p."id"
    LEFT JOIN LATERAL (
      SELECT i."storageKey", i."altEn", i."altAr" FROM "product_image" i
      WHERE i."productId" = p."id" ORDER BY i."sortOrder", i."id" LIMIT 1) img ON TRUE
    WHERE bi."bundleId" = ${bundleId}::uuid
    ORDER BY bi."sortOrder", p."slug"`;
}

/** The bundle's own pricing parameters (the page recomputes the quote from CURRENT component prices). */
export async function fetchBundlePricing(bundleId: string, db: Db = getDb()) {
  return db.product.findFirst({
    where: { id: bundleId, type: "BUNDLE" },
    select: {
      price: true,
      bundlePricingMode: true,
      bundleDiscountBps: true,
      bundleDiscountAmount: true,
    },
  });
}

/** Slugs of every product a shopper can see, for the sitemap. One statement. */
export async function fetchPublicProductSlugs(db: Db = getDb()): Promise<string[]> {
  const rows = await db.$queryRaw<{ slug: string }[]>(Prisma.sql`
    SELECT p."slug"
    FROM "product" p
    JOIN "category" cat ON cat."id" = p."categoryId"
    LEFT JOIN "brand" b ON b."id" = p."brandId"
    WHERE ${VISIBLE_PRODUCT}
    ORDER BY p."slug"`);
  return rows.map((r) => r.slug);
}
