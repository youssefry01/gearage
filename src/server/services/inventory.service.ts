import type { AdjustmentReason } from "@/generated/prisma/enums";
import {
  expandDemand,
  findShortages,
  StockError,
  type BundleComposition,
  type DemandEntry,
  type Shortage,
  type StockLine,
} from "@/domain/stock";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getDb } from "@/server/db";
import {
  decrementOnHand,
  incrementOnHand,
  lockActiveReservations,
  lockInventory,
  reservedByProduct,
  type Tx,
} from "@/server/repositories/inventory.repository";

/**
 * Stock operations (ADR 0008). The rules:
 *  - availability = onHand - active unexpired reservations; no stored "reserved" counter exists to drift;
 *  - EVERY operation that can change availability first locks the affected inventory rows in ascending product id
 *    order (deadlock-free) and then re-checks availability under the lock, so concurrent buyers can never oversell;
 *  - multi-product operations are all-or-nothing (one transaction; a shortage writes nothing);
 *  - bundle lines expand into their components and demand is aggregated across the whole cart BEFORE checking.
 * Functions take an optional `tx` so M6b can run "create order + take stock" in ONE transaction. All times are
 * explicit and UTC (`now` is injectable for tests).
 */
export type StockRequestLine = { productId: string; quantity: number };
export type StockOptions = { tx?: Tx; now?: Date };

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

async function inTransaction<T>(tx: Tx | undefined, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return tx ? fn(tx) : getDb().$transaction(fn, TX_OPTIONS);
}

const insufficient = (shortages: Shortage[]) =>
  new AppError("CONFLICT", "Not enough stock", {
    details: { code: "INSUFFICIENT_STOCK", shortages },
  });

/**
 * Validates the requested lines against the catalog and expands them into aggregated physical demand.
 * Every product must exist and be sellable (ACTIVE, not deleted); a bundle also needs every component sellable.
 */
async function demandFor(tx: Tx, lines: readonly StockRequestLine[]): Promise<DemandEntry[]> {
  if (lines.length === 0) throw new AppError("BAD_REQUEST", "No items requested");
  const ids = [...new Set(lines.map((l) => l.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, type: true, status: true, deletedAt: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0)
    throw new AppError("NOT_FOUND", "Product not found", {
      details: { code: "PRODUCT_NOT_FOUND", productIds: missing },
    });
  const unavailable = products
    .filter((p) => p.status !== "ACTIVE" || p.deletedAt !== null)
    .map((p) => p.id);

  const bundleIds = products.filter((p) => p.type === "BUNDLE").map((p) => p.id);
  const compositions = new Map<string, { componentId: string; quantity: number }[]>();
  if (bundleIds.length > 0) {
    const items = await tx.bundleItem.findMany({
      where: { bundleId: { in: bundleIds } },
      select: {
        bundleId: true,
        componentId: true,
        quantity: true,
        component: { select: { status: true, deletedAt: true } },
      },
    });
    for (const item of items) {
      compositions.set(item.bundleId, [
        ...(compositions.get(item.bundleId) ?? []),
        { componentId: item.componentId, quantity: item.quantity },
      ]);
      if (item.component.status !== "ACTIVE" || item.component.deletedAt !== null)
        unavailable.push(item.bundleId);
    }
  }
  if (unavailable.length > 0) {
    throw new AppError("CONFLICT", "Product unavailable", {
      details: { code: "PRODUCT_UNAVAILABLE", productIds: [...new Set(unavailable)] },
    });
  }

  const stockLines: StockLine[] = lines.map((l) => ({
    productId: l.productId,
    type: byId.get(l.productId)?.type ?? "PHYSICAL",
    quantity: l.quantity,
  }));
  try {
    return expandDemand(stockLines, compositions as BundleComposition);
  } catch (err) {
    if (err instanceof StockError) throw new AppError("BAD_REQUEST", err.message);
    throw err;
  }
}

/** Locks the demanded rows (ascending id) and returns available units per product, counted under the lock. */
async function lockAndMeasure(
  tx: Tx,
  demand: readonly DemandEntry[],
  now: Date,
  excludeOrderId?: string,
) {
  const ids = demand.map((d) => d.productId);
  const onHand = await lockInventory(tx, ids);
  const reserved = await reservedByProduct(tx, ids, now, excludeOrderId);
  const available = new Map(
    ids.map((id) => [id, Math.max((onHand.get(id) ?? 0) - (reserved.get(id) ?? 0), 0)]),
  );
  return { onHand, available };
}

/** Holds stock for an order for `ttlSeconds` (online payment in progress). All-or-nothing. */
export async function reserveStock(
  input: { lines: readonly StockRequestLine[]; orderId: string; ttlSeconds: number },
  { tx, now = new Date() }: StockOptions = {},
): Promise<{ reservationIds: string[]; expiresAt: Date }> {
  if (!Number.isInteger(input.ttlSeconds) || input.ttlSeconds <= 0)
    throw new AppError("BAD_REQUEST", "ttlSeconds must be a positive integer");
  const expiresAt = new Date(now.getTime() + input.ttlSeconds * 1000);
  return inTransaction(tx, async (t) => {
    const demand = await demandFor(t, input.lines);
    const { available } = await lockAndMeasure(t, demand, now);
    const shortages = findShortages(demand, available);
    if (shortages.length > 0) throw insufficient(shortages);

    const reservationIds: string[] = [];
    for (const d of demand) {
      const row = await t.stockReservation.create({
        data: {
          productId: d.productId,
          quantity: d.quantity,
          orderId: input.orderId,
          expiresAt,
          createdAt: now,
        },
        select: { id: true },
      });
      reservationIds.push(row.id);
    }
    return { reservationIds, expiresAt };
  });
}

/** Gives held stock back (payment failed or order cancelled). Idempotent. Returns how many reservations were released. */
export async function releaseReservations(
  orderId: string,
  { tx, now = new Date() }: StockOptions = {},
): Promise<number> {
  return inTransaction(tx, async (t) => {
    const result = await t.stockReservation.updateMany({
      where: { orderId, status: "ACTIVE" },
      data: { status: "RELEASED", resolvedAt: now },
    });
    return result.count;
  });
}

/** Marks every ACTIVE reservation past its expiry as EXPIRED. Idempotent; correctness never depends on it running. */
export async function expireReservations({
  tx,
  now = new Date(),
}: StockOptions = {}): Promise<number> {
  return inTransaction(tx, async (t) => {
    const result = await t.stockReservation.updateMany({
      where: { status: "ACTIVE", expiresAt: { lte: now } },
      data: { status: "EXPIRED", resolvedAt: now },
    });
    if (result.count > 0) logger.info("stock_reservations_expired", { count: result.count });
    return result.count;
  });
}

export type ConvertResult =
  | { status: "CONVERTED"; lines: { productId: string; quantity: number }[] }
  | { status: "ALREADY_CONVERTED" }
  | { status: "NOT_ACTIVE" }
  | { status: "UNFULFILLABLE"; shortages: Shortage[] };

/**
 * Turns an order's reservations into real stock decrements (payment confirmed). Safe to call twice (webhooks retry):
 * the second call returns ALREADY_CONVERTED and changes nothing. If a reservation had already expired and the stock
 * was meanwhile taken by someone else, nothing changes and UNFULFILLABLE tells the caller to refund or backorder.
 */
export async function convertReservations(
  orderId: string,
  { tx, now = new Date() }: StockOptions = {},
): Promise<ConvertResult> {
  return inTransaction(tx, async (t) => {
    const probe = await t.stockReservation.findMany({
      where: { orderId },
      select: { id: true, productId: true, status: true },
    });
    const active = probe.filter((r) => r.status === "ACTIVE");
    if (active.length === 0) {
      if (probe.some((r) => r.status === "CONVERTED"))
        return { status: "ALREADY_CONVERTED" } as const;
      return { status: "NOT_ACTIVE" } as const;
    }

    // Lock inventory first (ascending), then the order's reservation rows, so we queue behind any competing buyer.
    const ids = [...new Set(active.map((r) => r.productId))].sort();
    const onHand = await lockInventory(t, ids);
    const reservations = await lockActiveReservations(t, orderId);
    if (reservations.length === 0) return { status: "ALREADY_CONVERTED" } as const; // lost a race with another convert

    const wanted = new Map<string, number>();
    for (const r of reservations)
      wanted.set(r.productId, (wanted.get(r.productId) ?? 0) + r.quantity);
    const otherReserved = await reservedByProduct(t, ids, now, orderId);
    const demand: DemandEntry[] = [...wanted.entries()].map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
    const free = new Map(
      ids.map((id) => [id, Math.max((onHand.get(id) ?? 0) - (otherReserved.get(id) ?? 0), 0)]),
    );
    const shortages = findShortages(demand, free);
    if (shortages.length > 0) return { status: "UNFULFILLABLE", shortages } as const;

    for (const d of demand) {
      const after = await decrementOnHand(t, d.productId, d.quantity, now);
      if (after === null) throw new AppError("INTERNAL", "Stock changed under lock"); // cannot happen: rows are locked
      await t.inventoryAdjustment.create({
        data: {
          productId: d.productId,
          delta: -d.quantity,
          onHandAfter: after,
          reason: "SOLD",
          orderId,
          createdAt: now,
        },
      });
    }
    await t.stockReservation.updateMany({
      where: { id: { in: reservations.map((r) => r.id) }, status: "ACTIVE" },
      data: { status: "CONVERTED", resolvedAt: now },
    });
    return { status: "CONVERTED", lines: demand } as const;
  });
}

/** Cash on Delivery: takes stock immediately, no reservation step. All-or-nothing, oversell-proof. */
export async function decrementStock(
  input: { lines: readonly StockRequestLine[]; orderId: string },
  { tx, now = new Date() }: StockOptions = {},
): Promise<DemandEntry[]> {
  return inTransaction(tx, async (t) => {
    const demand = await demandFor(t, input.lines);
    const { available } = await lockAndMeasure(t, demand, now); // other buyers' active reservations still count
    const shortages = findShortages(demand, available);
    if (shortages.length > 0) throw insufficient(shortages);

    for (const d of demand) {
      const after = await decrementOnHand(t, d.productId, d.quantity, now);
      if (after === null) throw new AppError("INTERNAL", "Stock changed under lock");
      await t.inventoryAdjustment.create({
        data: {
          productId: d.productId,
          delta: -d.quantity,
          onHandAfter: after,
          reason: "SOLD",
          orderId: input.orderId,
          createdAt: now,
        },
      });
    }
    return demand;
  });
}

/** Puts units back (order cancelled after stock was taken, or a returned item). Also used for receiving goods. */
export async function restockUnits(
  entries: readonly DemandEntry[],
  input: {
    reason: Extract<AdjustmentReason, "CANCEL_RESTOCK" | "RETURN_RESTOCK" | "RECEIVED">;
    orderId?: string;
    actorId?: string;
    note?: string;
  },
  { tx, now = new Date() }: StockOptions = {},
): Promise<void> {
  const sorted = [...entries].sort((a, b) =>
    a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0,
  );
  await inTransaction(tx, async (t) => {
    for (const e of sorted) {
      if (!Number.isInteger(e.quantity) || e.quantity <= 0)
        throw new AppError("BAD_REQUEST", "Restock quantity must be a positive integer");
      const after = await incrementOnHand(t, e.productId, e.quantity, now);
      await t.inventoryAdjustment.create({
        data: {
          productId: e.productId,
          delta: e.quantity,
          onHandAfter: after,
          reason: input.reason,
          orderId: input.orderId ?? null,
          actorId: input.actorId ?? null,
          note: input.note ?? null,
          createdAt: now,
        },
      });
    }
  });
}

/**
 * Manual correction by staff (count, damage, goods received). Never takes stock below what active reservations hold:
 * that would oversell orders that are already paying.
 */
export async function adjustStock(
  input: {
    productId: string;
    delta: number;
    reason: AdjustmentReason;
    note?: string;
    actorId?: string;
  },
  { tx, now = new Date() }: StockOptions = {},
): Promise<{ onHand: number }> {
  if (!Number.isInteger(input.delta) || input.delta === 0)
    throw new AppError("BAD_REQUEST", "delta must be a non-zero integer");
  return inTransaction(tx, async (t) => {
    const product = await t.product.findUnique({
      where: { id: input.productId },
      select: { type: true },
    });
    if (!product) throw new AppError("NOT_FOUND", "Product not found");
    if (product.type !== "PHYSICAL")
      throw new AppError("BAD_REQUEST", "Only physical products have stock");

    let onHand: number;
    if (input.delta > 0) {
      onHand = await incrementOnHand(t, input.productId, input.delta, now); // creates the row on first receipt
    } else {
      const locked = await lockInventory(t, [input.productId]);
      const current = locked.get(input.productId) ?? 0;
      const reserved =
        (await reservedByProduct(t, [input.productId], now)).get(input.productId) ?? 0;
      if (current + input.delta < 0)
        throw new AppError("CONFLICT", "Stock cannot go below zero", {
          details: { code: "NEGATIVE_STOCK", onHand: current },
        });
      if (current + input.delta < reserved) {
        throw new AppError("CONFLICT", "Stock cannot go below what is reserved", {
          details: { code: "BELOW_RESERVED", onHand: current, reserved },
        });
      }
      const after = await decrementOnHand(t, input.productId, -input.delta, now);
      if (after === null) throw new AppError("INTERNAL", "Stock changed under lock");
      onHand = after;
    }
    await t.inventoryAdjustment.create({
      data: {
        productId: input.productId,
        delta: input.delta,
        onHandAfter: onHand,
        reason: input.reason,
        note: input.note ?? null,
        actorId: input.actorId ?? null,
        createdAt: now,
      },
    });
    return { onHand };
  });
}
