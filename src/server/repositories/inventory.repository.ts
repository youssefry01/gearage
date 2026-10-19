import { Prisma } from "@/generated/prisma/client";

/** A Prisma transaction client: every function here takes one so a caller can compose several steps atomically. */
export type Tx = Prisma.TransactionClient;

/**
 * A `timestamp` (no zone) literal holding the UTC wall clock of `date`. Prisma stores DateTime as UTC in `timestamp`
 * columns, so raw SQL must compare against UTC too, whatever the Node or PostgreSQL session time zone is (many
 * Windows installs default to Cairo time).
 */
export const utc = (date: Date): Prisma.Sql => Prisma.sql`${date.toISOString()}::timestamp`;

/**
 * Locks the inventory rows of `productIds` in ASCENDING product id order and returns their stock on hand.
 * Every operation that changes availability takes locks through this function, in this order, so two checkouts that
 * touch the same products in different cart order can never deadlock (ADR 0008). Products without an inventory row
 * are simply absent from the result.
 */
export async function lockInventory(
  tx: Tx,
  productIds: readonly string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const rows = await tx.$queryRaw<{ productId: string; onHand: number }[]>`
    SELECT "productId", "onHand" FROM "inventory"
    WHERE "productId" = ANY(${[...productIds]}::uuid[])
    ORDER BY "productId"
    FOR UPDATE`;
  return new Map(rows.map((r) => [r.productId, r.onHand]));
}

/** Units held by ACTIVE, unexpired reservations, optionally ignoring one order's own reservations. */
export async function reservedByProduct(
  tx: Tx,
  productIds: readonly string[],
  now: Date,
  excludeOrderId?: string,
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const exclude = excludeOrderId
    ? Prisma.sql`AND ("orderId" IS NULL OR "orderId" <> ${excludeOrderId}::uuid)`
    : Prisma.empty;
  const rows = await tx.$queryRaw<{ productId: string; qty: number }[]>`
    SELECT "productId", SUM("quantity")::int AS qty FROM "stock_reservation"
    WHERE "productId" = ANY(${[...productIds]}::uuid[])
      AND "status" = 'ACTIVE' AND "expiresAt" > ${utc(now)}
      ${exclude}
    GROUP BY "productId"`;
  return new Map(rows.map((r) => [r.productId, r.qty]));
}

/** Removes `quantity` units. Returns the new stock on hand, or null when there was not enough (nothing changed). */
export async function decrementOnHand(
  tx: Tx,
  productId: string,
  quantity: number,
  now: Date,
): Promise<number | null> {
  const rows = await tx.$queryRaw<{ onHand: number }[]>`
    UPDATE "inventory" SET "onHand" = "onHand" - ${quantity}, "updatedAt" = ${utc(now)}
    WHERE "productId" = ${productId}::uuid AND "onHand" >= ${quantity}
    RETURNING "onHand"`;
  return rows[0]?.onHand ?? null;
}

/** Adds `quantity` units, creating the inventory row if the product has none. Returns the new stock on hand. */
export async function incrementOnHand(
  tx: Tx,
  productId: string,
  quantity: number,
  now: Date,
): Promise<number> {
  const rows = await tx.$queryRaw<{ onHand: number }[]>`
    INSERT INTO "inventory" ("productId", "onHand", "updatedAt")
    VALUES (${productId}::uuid, ${quantity}, ${utc(now)})
    ON CONFLICT ("productId") DO UPDATE
      SET "onHand" = "inventory"."onHand" + EXCLUDED."onHand", "updatedAt" = EXCLUDED."updatedAt"
    RETURNING "onHand"`;
  return rows[0]?.onHand ?? 0;
}

export type LockedReservation = {
  id: string;
  productId: string;
  quantity: number;
  expiresAt: Date;
};

/** The still-ACTIVE reservations of an order, row-locked in a fixed order. */
export async function lockActiveReservations(
  tx: Tx,
  orderId: string,
): Promise<LockedReservation[]> {
  return tx.$queryRaw<LockedReservation[]>`
    SELECT "id", "productId", "quantity", "expiresAt" FROM "stock_reservation"
    WHERE "orderId" = ${orderId}::uuid AND "status" = 'ACTIVE'
    ORDER BY "productId", "id"
    FOR UPDATE`;
}
