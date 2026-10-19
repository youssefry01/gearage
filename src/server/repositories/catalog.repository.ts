import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import type { Tx } from "./inventory.repository";

type Db = Tx | ReturnType<typeof getDb>;

/** Units available per product from the product_availability view. `null` = not stock-tracked (gift cards, digital). */
export async function fetchAvailability(
  productIds: readonly string[],
  db: Db = getDb(),
): Promise<Map<string, number | null>> {
  if (productIds.length === 0) return new Map();
  const rows = await db.$queryRaw<{ productId: string; available: number | null }[]>`
    SELECT "productId", "available"::int AS available FROM "product_availability"
    WHERE "productId" = ANY(${[...productIds]}::uuid[])`;
  return new Map(rows.map((r) => [r.productId, r.available]));
}

export type BundleComponentRow = {
  componentId: string;
  quantity: number;
  sortOrder: number;
  slug: string;
  sku: string;
  titleEn: string;
  titleAr: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  deleted: boolean;
  price: number;
  cost: number | null;
  specs: Record<string, unknown>;
  categoryPath: string;
  available: number;
};

/** Every component of a bundle with its price, specs, category and availability: one query, no N+1. */
export async function fetchBundleComponents(
  bundleId: string,
  db: Db = getDb(),
): Promise<BundleComponentRow[]> {
  return db.$queryRaw<BundleComponentRow[]>`
    SELECT bi."componentId", bi."quantity", bi."sortOrder",
           c."slug", c."sku", c."titleEn", c."titleAr", c."status",
           (c."deletedAt" IS NOT NULL) AS deleted,
           c."price", c."cost", c."specs", cat."path" AS "categoryPath",
           COALESCE(av."available", 0)::int AS available
    FROM "bundle_item" bi
    JOIN "product" c ON c."id" = bi."componentId"
    JOIN "category" cat ON cat."id" = c."categoryId"
    LEFT JOIN "product_availability" av ON av."productId" = c."id"
    WHERE bi."bundleId" = ${bundleId}::uuid
    ORDER BY bi."sortOrder", c."slug"`;
}

export type StorefrontRow = {
  id: string;
  type: "PHYSICAL" | "BUNDLE" | "GIFT_CARD" | "DIGITAL";
  slug: string;
  sku: string;
  titleEn: string;
  titleAr: string;
  brandId: string | null;
  categoryPath: string;
  effectivePrice: number;
  listTotal: number;
  compareAtPrice: number | null;
  /** null = not stock-tracked. */
  available: number | null;
  lowStockThreshold: number;
  unitsSold: number;
  viewCount: number;
  createdAt: Date;
};

export type StorefrontQuery = {
  /** Category path prefix, e.g. "components/cpus" matches that category and everything below it. */
  categoryPath?: string;
  inStockOnly?: boolean;
  limit: number;
  offset: number;
};

/**
 * Storefront listing in ONE query: ACTIVE, non-deleted products with their effective price (bundle prices derived
 * from components) and availability (bundles derived from components). Works for physical products and bundles alike.
 */
export async function listStorefront(
  query: StorefrontQuery,
  db: Db = getDb(),
): Promise<StorefrontRow[]> {
  const category = query.categoryPath
    ? Prisma.sql`AND (cat."path" = ${query.categoryPath} OR cat."path" LIKE ${query.categoryPath.replace(/[\\%_]/g, "\\$&") + "/%"})`
    : Prisma.empty;
  const inStock = query.inStockOnly
    ? Prisma.sql`AND (av."available" IS NULL OR av."available" > 0)`
    : Prisma.empty;
  return db.$queryRaw<StorefrontRow[]>`
    SELECT p."id", p."type", p."slug", p."sku", p."titleEn", p."titleAr", p."brandId",
           cat."path" AS "categoryPath",
           pr."effectivePrice"::int AS "effectivePrice", pr."listTotal"::int AS "listTotal",
           p."compareAtPrice", av."available"::int AS available,
           p."lowStockThreshold", p."unitsSold", p."viewCount", p."createdAt"
    FROM "product" p
    JOIN "category" cat ON cat."id" = p."categoryId"
    JOIN "product_pricing" pr ON pr."productId" = p."id"
    JOIN "product_availability" av ON av."productId" = p."id"
    WHERE p."status" = 'ACTIVE' AND p."deletedAt" IS NULL
      ${category}
      ${inStock}
    ORDER BY p."createdAt" DESC, p."id"
    LIMIT ${query.limit} OFFSET ${query.offset}`;
}
