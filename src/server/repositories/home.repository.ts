import { Prisma } from "@/generated/prisma/client";
import type { BrandCategoryCount } from "@/domain/home";
import { getDb } from "@/server/db";
import { VISIBLE_PRODUCT } from "./visibility";

type Db = ReturnType<typeof getDb>;

export type BrandCategoryRow = BrandCategoryCount & {
  brandNameEn: string;
  brandNameAr: string | null;
};

/**
 * Visible products per brand and top-level category, in ONE statement (no per-brand queries). The service folds it
 * into the brand strip. Uses the shared visibility rule, so a brand only appears here with products a shopper can
 * actually see. Products without a brand are not part of a brand strip.
 */
export async function fetchBrandCategoryCounts(db: Db = getDb()): Promise<BrandCategoryRow[]> {
  return db.$queryRaw<BrandCategoryRow[]>(Prisma.sql`
    SELECT b."slug" AS "brandSlug", b."nameEn" AS "brandNameEn", b."nameAr" AS "brandNameAr",
           split_part(cat."path", '/', 1) AS "topPath", COUNT(*)::int AS "count"
    FROM "product" p
    JOIN "category" cat ON cat."id" = p."categoryId"
    JOIN "brand" b ON b."id" = p."brandId"
    WHERE ${VISIBLE_PRODUCT}
    GROUP BY b."slug", b."nameEn", b."nameAr", split_part(cat."path", '/', 1)`);
}
