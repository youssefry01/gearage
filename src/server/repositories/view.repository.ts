import { getDb } from "@/server/db/client";
import { VISIBLE_PRODUCT } from "@/server/repositories/visibility";

type Db = Pick<ReturnType<typeof getDb>, "$queryRaw" | "$executeRaw" | "$transaction">;

/**
 * Counts one view of the visible product with this slug: one row per product and UTC day, plus the running total the
 * "most viewed" shelf sorts by. One statement; returns false when no visible product has that slug (nothing is
 * counted, and the caller does not say so to the visitor).
 */
export async function incrementViews(
  slug: string,
  day: string,
  db: Db = getDb(),
): Promise<boolean> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    WITH target AS (
      SELECT p."id"
      FROM "product" p
      JOIN "category" cat ON cat."id" = p."categoryId"
      LEFT JOIN "brand" b ON b."id" = p."brandId"
      WHERE p."slug" = ${slug} AND ${VISIBLE_PRODUCT}
    ), bump AS (
      UPDATE "product" SET "viewCount" = "viewCount" + 1 WHERE "id" IN (SELECT "id" FROM target) RETURNING "id"
    ), daily AS (
      INSERT INTO "product_view_daily" ("productId", "day", "count")
      SELECT "id", ${day}::date, 1 FROM target
      ON CONFLICT ("productId", "day") DO UPDATE SET "count" = "product_view_daily"."count" + 1
      RETURNING "productId"
    )
    SELECT "id" FROM bump`;
  return rows.length > 0;
}
