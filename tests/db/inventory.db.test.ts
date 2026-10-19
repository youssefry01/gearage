import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { isAppError } from "@/lib/errors";
import { fetchAvailability } from "@/server/repositories/catalog.repository";
import {
  adjustStock,
  convertReservations,
  decrementStock,
  expireReservations,
  releaseReservations,
  reserveStock,
  restockUnits,
} from "@/server/services/inventory.service";
import { db, makeBundle, makeProduct, onHandOf, resetData } from "./helpers";

beforeEach(resetData);

const available = async (id: string) => (await fetchAvailability([id])).get(id);
const line = (p: { id: string }, quantity = 1) => ({ productId: p.id, quantity });
const reasonOf = (err: unknown) =>
  isAppError(err) ? (err.details as { code?: string } | undefined)?.code : undefined;

/** Runs `n` operations at the same instant and classifies the outcomes. Anything but success or INSUFFICIENT_STOCK is a bug (deadlock, serialization failure...). */
async function race<T>(n: number, op: (i: number) => Promise<T>) {
  const settled = await Promise.allSettled(Array.from({ length: n }, (_, i) => op(i)));
  const ok = settled
    .filter((s): s is PromiseFulfilledResult<Awaited<T>> => s.status === "fulfilled")
    .map((s) => s.value);
  const rejected = settled
    .filter((s): s is PromiseRejectedResult => s.status === "rejected")
    .map((s) => s.reason as unknown);
  const insufficient = rejected.filter((e) => reasonOf(e) === "INSUFFICIENT_STOCK");
  const other = rejected.filter((e) => reasonOf(e) !== "INSUFFICIENT_STOCK");
  return { ok, insufficient: insufficient.length, other };
}

describe("adjustStock", () => {
  it("receives goods (creating the inventory row) and keeps an append-only history", async () => {
    const p = await makeProduct();
    expect(
      await adjustStock({ productId: p.id, delta: 10, reason: "RECEIVED", note: "PO 1" }),
    ).toEqual({ onHand: 10 });
    expect(await adjustStock({ productId: p.id, delta: -3, reason: "DAMAGED" })).toEqual({
      onHand: 7,
    });
    const history = await db().inventoryAdjustment.findMany({
      where: { productId: p.id },
      orderBy: { createdAt: "asc" },
    });
    expect(history.map((h) => [h.delta, h.onHandAfter, h.reason])).toEqual([
      [10, 10, "RECEIVED"],
      [-3, 7, "DAMAGED"],
    ]);
  });
  it("refuses to go below zero or below what active reservations hold", async () => {
    const p = await makeProduct({ onHand: 5 });
    await expect(
      adjustStock({ productId: p.id, delta: -6, reason: "CORRECTION" }),
    ).rejects.toMatchObject({ details: { code: "NEGATIVE_STOCK" } });
    await reserveStock({ lines: [line(p, 4)], orderId: randomUUID(), ttlSeconds: 600 });
    await expect(
      adjustStock({ productId: p.id, delta: -2, reason: "COUNT" }),
    ).rejects.toMatchObject({ details: { code: "BELOW_RESERVED" } });
    expect(await adjustStock({ productId: p.id, delta: -1, reason: "COUNT" })).toEqual({
      onHand: 4,
    }); // exactly what is reserved
    expect(await onHandOf(p.id)).toBe(4);
  });
  it("validates its input", async () => {
    const p = await makeProduct({ onHand: 1 });
    const gift = await makeProduct({ type: "GIFT_CARD" });
    await expect(adjustStock({ productId: p.id, delta: 0, reason: "OTHER" })).rejects.toMatchObject(
      { code: "BAD_REQUEST" },
    );
    await expect(
      adjustStock({ productId: p.id, delta: 1.5, reason: "OTHER" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      adjustStock({ productId: gift.id, delta: 1, reason: "RECEIVED" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      adjustStock({ productId: randomUUID(), delta: 1, reason: "RECEIVED" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("reserveStock", () => {
  it("holds stock, which the availability view then excludes", async () => {
    const p = await makeProduct({ onHand: 10 });
    const { reservationIds } = await reserveStock({
      lines: [line(p, 4)],
      orderId: randomUUID(),
      ttlSeconds: 900,
    });
    expect(reservationIds).toHaveLength(1);
    expect(await available(p.id)).toBe(6);
    expect(await onHandOf(p.id)).toBe(10); // nothing is decremented until conversion
  });
  it("is ALL-OR-NOTHING: one short product rejects the whole request and writes nothing", async () => {
    const plenty = await makeProduct({ onHand: 10 });
    const scarce = await makeProduct({ onHand: 1 });
    await expect(
      reserveStock({
        lines: [line(plenty, 2), line(scarce, 2)],
        orderId: randomUUID(),
        ttlSeconds: 600,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      details: {
        code: "INSUFFICIENT_STOCK",
        shortages: [{ productId: scarce.id, requested: 2, available: 1 }],
      },
    });
    expect(await db().stockReservation.count()).toBe(0);
    expect(await available(plenty.id)).toBe(10);
  });
  it("expands bundles and AGGREGATES demand across lines (each line fits alone, together they do not)", async () => {
    const shared = await makeProduct({ onHand: 3 });
    const other = await makeProduct({ onHand: 10 });
    const bundle = await makeBundle({
      components: [{ product: shared, quantity: 2 }, { product: other }],
    });
    // one bundle needs 2 of `shared`; two extra singles need 2 more: 4 > 3
    await expect(
      reserveStock({
        lines: [line(bundle), line(shared, 2)],
        orderId: randomUUID(),
        ttlSeconds: 600,
      }),
    ).rejects.toMatchObject({
      details: {
        code: "INSUFFICIENT_STOCK",
        shortages: [{ productId: shared.id, requested: 4, available: 3 }],
      },
    });
    expect(await db().stockReservation.count()).toBe(0);
    await reserveStock({
      lines: [line(bundle), line(shared, 1)],
      orderId: randomUUID(),
      ttlSeconds: 600,
    }); // 3 <= 3
    expect(await available(shared.id)).toBe(0);
    expect(await available(bundle.id)).toBe(0);
  });
  it("rejects missing, archived and deleted products, and bundles with an unavailable component", async () => {
    const live = await makeProduct({ onHand: 5 });
    const archived = await makeProduct({ onHand: 5, status: "ARCHIVED" });
    const deleted = await makeProduct({ onHand: 5, deletedAt: new Date() });
    const bundle = await makeBundle({ components: [{ product: live }, { product: archived }] });
    const reserve = (productId: string) =>
      reserveStock({ lines: [{ productId, quantity: 1 }], orderId: randomUUID(), ttlSeconds: 60 });
    await expect(reserve(randomUUID())).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(reserve(archived.id)).rejects.toMatchObject({
      details: { code: "PRODUCT_UNAVAILABLE" },
    });
    await expect(reserve(deleted.id)).rejects.toMatchObject({
      details: { code: "PRODUCT_UNAVAILABLE" },
    });
    await expect(reserve(bundle.id)).rejects.toMatchObject({
      details: { code: "PRODUCT_UNAVAILABLE" },
    });
  });
  it("rejects empty carts, bad quantities and bad TTLs; gift cards need no stock", async () => {
    const p = await makeProduct({ onHand: 5 });
    const gift = await makeProduct({ type: "GIFT_CARD" });
    const orderId = randomUUID();
    await expect(reserveStock({ lines: [], orderId, ttlSeconds: 60 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      reserveStock({ lines: [line(p, 0)], orderId, ttlSeconds: 60 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(reserveStock({ lines: [line(p)], orderId, ttlSeconds: 0 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(
      (await reserveStock({ lines: [line(gift, 2)], orderId, ttlSeconds: 60 })).reservationIds,
    ).toEqual([]);
  });
  it("a reservation stops holding stock once it expires, with or without the sweeper", async () => {
    const p = await makeProduct({ onHand: 5 });
    await reserveStock(
      { lines: [line(p, 5)], orderId: randomUUID(), ttlSeconds: 60 },
      { now: new Date(Date.now() - 3_600_000) },
    ); // created an hour ago, expired 59 minutes ago
    expect(await available(p.id)).toBe(5); // the view already ignores it
    expect(await expireReservations()).toBe(1); // housekeeping marks it
    expect(await expireReservations()).toBe(0); // idempotent
    expect((await db().stockReservation.findFirstOrThrow()).status).toBe("EXPIRED");
  });
  it("composes into an outer transaction: if the caller fails afterwards, the reservation rolls back", async () => {
    const p = await makeProduct({ onHand: 5 });
    await expect(
      db().$transaction(async (tx) => {
        await reserveStock({ lines: [line(p, 3)], orderId: randomUUID(), ttlSeconds: 600 }, { tx });
        throw new Error("order insert failed");
      }),
    ).rejects.toThrow("order insert failed");
    expect(await db().stockReservation.count()).toBe(0);
    expect(await available(p.id)).toBe(5);
  });
});

describe("releaseReservations", () => {
  it("gives stock back and is idempotent", async () => {
    const p = await makeProduct({ onHand: 5 });
    const orderId = randomUUID();
    await reserveStock({ lines: [line(p, 5)], orderId, ttlSeconds: 600 });
    expect(await available(p.id)).toBe(0);
    expect(await releaseReservations(orderId)).toBe(1);
    expect(await releaseReservations(orderId)).toBe(0);
    expect(await available(p.id)).toBe(5);
  });
});

describe("convertReservations (payment confirmed)", () => {
  it("turns reservations into decrements with SOLD history, per component for bundles", async () => {
    const cpu = await makeProduct({ onHand: 5 });
    const ram = await makeProduct({ onHand: 8 });
    const bundle = await makeBundle({
      components: [{ product: cpu }, { product: ram, quantity: 2 }],
    });
    const orderId = randomUUID();
    await reserveStock({ lines: [line(bundle, 2)], orderId, ttlSeconds: 600 });
    const result = await convertReservations(orderId);
    expect(result.status).toBe("CONVERTED");
    expect(await onHandOf(cpu.id)).toBe(3);
    expect(await onHandOf(ram.id)).toBe(4);
    const sold = await db().inventoryAdjustment.findMany({ where: { orderId, reason: "SOLD" } });
    expect(sold.map((a) => a.delta).sort((x, y) => x - y)).toEqual([-4, -2]);
    expect((await db().stockReservation.findMany()).every((r) => r.status === "CONVERTED")).toBe(
      true,
    );
    expect(await available(bundle.id)).toBe(2); // cpu 3, ram 4/2: min = 2
  });
  it("is IDEMPOTENT: a retried webhook changes nothing", async () => {
    const p = await makeProduct({ onHand: 5 });
    const orderId = randomUUID();
    await reserveStock({ lines: [line(p, 2)], orderId, ttlSeconds: 600 });
    expect((await convertReservations(orderId)).status).toBe("CONVERTED");
    expect((await convertReservations(orderId)).status).toBe("ALREADY_CONVERTED");
    expect(await onHandOf(p.id)).toBe(3);
    expect(await db().inventoryAdjustment.count({ where: { orderId } })).toBe(1);
  });
  it("reports NOT_ACTIVE for unknown or released orders", async () => {
    const p = await makeProduct({ onHand: 5 });
    const orderId = randomUUID();
    await reserveStock({ lines: [line(p)], orderId, ttlSeconds: 600 });
    await releaseReservations(orderId);
    expect((await convertReservations(orderId)).status).toBe("NOT_ACTIVE");
    expect((await convertReservations(randomUUID())).status).toBe("NOT_ACTIVE");
    expect(await onHandOf(p.id)).toBe(5);
  });
  it("a LATE payment still converts when the stock is still free", async () => {
    const p = await makeProduct({ onHand: 3 });
    const orderId = randomUUID();
    await reserveStock(
      { lines: [line(p, 2)], orderId, ttlSeconds: 60 },
      { now: new Date(Date.now() - 3_600_000) },
    ); // long expired
    expect((await convertReservations(orderId)).status).toBe("CONVERTED");
    expect(await onHandOf(p.id)).toBe(1);
  });
  it("a late payment is UNFULFILLABLE when someone else took the stock, and changes NOTHING", async () => {
    const p = await makeProduct({ onHand: 2 });
    const late = randomUUID();
    await reserveStock(
      { lines: [line(p, 2)], orderId: late, ttlSeconds: 60 },
      { now: new Date(Date.now() - 3_600_000) },
    ); // expired
    await reserveStock({ lines: [line(p, 2)], orderId: randomUUID(), ttlSeconds: 600 }); // a newer customer holds all of it
    const result = await convertReservations(late);
    expect(result).toEqual({
      status: "UNFULFILLABLE",
      shortages: [{ productId: p.id, requested: 2, available: 0 }],
    });
    expect(await onHandOf(p.id)).toBe(2);
    expect(
      (await db().stockReservation.findFirstOrThrow({ where: { orderId: late } })).status,
    ).toBe("ACTIVE"); // caller decides: refund or backorder
  });
});

describe("decrementStock (Cash on Delivery)", () => {
  it("takes stock immediately with history, expanding bundles", async () => {
    const a = await makeProduct({ onHand: 5 });
    const b = await makeProduct({ onHand: 5 });
    const bundle = await makeBundle({ components: [{ product: a }, { product: b, quantity: 2 }] });
    const orderId = randomUUID();
    const demand = await decrementStock({ lines: [line(bundle, 2), line(a, 1)], orderId });
    expect(Object.fromEntries(demand.map((d) => [d.productId, d.quantity]))).toEqual({
      [a.id]: 3,
      [b.id]: 4,
    });
    expect(await onHandOf(a.id)).toBe(2);
    expect(await onHandOf(b.id)).toBe(1);
    expect(await db().inventoryAdjustment.count({ where: { orderId, reason: "SOLD" } })).toBe(2);
  });
  it("cannot take units that other customers have reserved", async () => {
    const p = await makeProduct({ onHand: 5 });
    await reserveStock({ lines: [line(p, 4)], orderId: randomUUID(), ttlSeconds: 600 });
    await expect(
      decrementStock({ lines: [line(p, 2)], orderId: randomUUID() }),
    ).rejects.toMatchObject({ details: { code: "INSUFFICIENT_STOCK" } });
    await decrementStock({ lines: [line(p, 1)], orderId: randomUUID() });
    expect(await onHandOf(p.id)).toBe(4);
  });
  it("is all-or-nothing", async () => {
    const plenty = await makeProduct({ onHand: 9 });
    const scarce = await makeProduct({ onHand: 1 });
    await expect(
      decrementStock({ lines: [line(plenty, 3), line(scarce, 2)], orderId: randomUUID() }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await onHandOf(plenty.id)).toBe(9);
    expect(await db().inventoryAdjustment.count()).toBe(0);
  });
});

describe("restockUnits", () => {
  it("puts units back with history (cancellation or return)", async () => {
    const p = await makeProduct({ onHand: 5 });
    const orderId = randomUUID();
    await decrementStock({ lines: [line(p, 2)], orderId });
    await restockUnits([{ productId: p.id, quantity: 2 }], { reason: "CANCEL_RESTOCK", orderId });
    expect(await onHandOf(p.id)).toBe(5);
    expect(
      (
        await db().inventoryAdjustment.findMany({
          where: { orderId },
          orderBy: { createdAt: "asc" },
        })
      ).map((a) => a.reason),
    ).toEqual(["SOLD", "CANCEL_RESTOCK"]);
    await expect(
      restockUnits([{ productId: p.id, quantity: 0 }], { reason: "RETURN_RESTOCK" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("CONCURRENCY: simultaneous buyers can never oversell", () => {
  it("50 Cash-on-Delivery orders race for 20 units: exactly 20 win, stock ends at 0", async () => {
    const p = await makeProduct({ onHand: 20 });
    const { ok, insufficient, other } = await race(50, () =>
      decrementStock({ lines: [line(p)], orderId: randomUUID() }),
    );
    expect(other).toEqual([]);
    expect(ok).toHaveLength(20);
    expect(insufficient).toBe(30);
    expect(await onHandOf(p.id)).toBe(0);
    expect(
      await db().inventoryAdjustment.count({ where: { productId: p.id, reason: "SOLD" } }),
    ).toBe(20);
  });
  it("40 reservations race for 10 units: exactly 10 win and the product shows 0 available", async () => {
    const p = await makeProduct({ onHand: 10 });
    const { ok, insufficient, other } = await race(40, () =>
      reserveStock({ lines: [line(p)], orderId: randomUUID(), ttlSeconds: 600 }),
    );
    expect(other).toEqual([]);
    expect(ok).toHaveLength(10);
    expect(insufficient).toBe(30);
    expect(await available(p.id)).toBe(0);
    expect(await db().stockReservation.count({ where: { status: "ACTIVE" } })).toBe(10);
  });
  it("reservations and Cash-on-Delivery orders contending for the same 10 units never exceed 10 in total", async () => {
    const p = await makeProduct({ onHand: 10 });
    const { ok, other } = await race<unknown>(40, (i) =>
      i % 2 === 0
        ? reserveStock({ lines: [line(p)], orderId: randomUUID(), ttlSeconds: 600 })
        : decrementStock({ lines: [line(p)], orderId: randomUUID() }),
    );
    expect(other).toEqual([]);
    expect(ok).toHaveLength(10); // every unit goes to exactly one buyer
    const onHand = await onHandOf(p.id);
    const held = await db().stockReservation.count({ where: { status: "ACTIVE" } });
    expect(onHand).toBeGreaterThanOrEqual(0);
    expect(held).toBeLessThanOrEqual(onHand);
    expect(10 - onHand + held).toBe(10); // sold + held = 10, nothing lost, nothing invented
  });
  it("opposite line order across products cannot deadlock (ascending lock order)", async () => {
    const a = await makeProduct({ onHand: 30 });
    const b = await makeProduct({ onHand: 30 });
    const { ok, insufficient, other } = await race(60, (i) =>
      decrementStock({
        lines: i % 2 === 0 ? [line(a), line(b)] : [line(b), line(a)],
        orderId: randomUUID(),
      }),
    );
    expect(other, "a deadlock or serialization error would show up here").toEqual([]);
    expect(ok).toHaveLength(30);
    expect(insufficient).toBe(30);
    expect(await onHandOf(a.id)).toBe(0);
    expect(await onHandOf(b.id)).toBe(0);
  });
  it("bundles and single parts sharing a component never sell more than exists", async () => {
    const shared = await makeProduct({ onHand: 6 });
    const extra = await makeProduct({ onHand: 100 });
    const bundle = await makeBundle({
      components: [{ product: shared, quantity: 2 }, { product: extra }],
    });
    const { ok, other } = await race(24, (i) =>
      decrementStock({ lines: [i % 3 === 0 ? line(shared) : line(bundle)], orderId: randomUUID() }),
    );
    expect(other).toEqual([]);
    const onHand = await onHandOf(shared.id);
    const units = (
      await db().inventoryAdjustment.findMany({ where: { productId: shared.id, reason: "SOLD" } })
    ).reduce((s, a) => s - a.delta, 0);
    expect(onHand).toBeGreaterThanOrEqual(0);
    expect(units).toBe(6 - onHand);
    expect(units).toBeLessThanOrEqual(6);
    expect(ok.length).toBeGreaterThan(0);
  });
  it("10 simultaneous payment confirmations of ONE order decrement stock exactly once", async () => {
    const p = await makeProduct({ onHand: 5 });
    const orderId = randomUUID();
    await reserveStock({ lines: [line(p, 2)], orderId, ttlSeconds: 600 });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => convertReservations(orderId)),
    );
    expect(results.filter((r) => r.status === "CONVERTED")).toHaveLength(1);
    expect(results.filter((r) => r.status === "ALREADY_CONVERTED")).toHaveLength(9);
    expect(await onHandOf(p.id)).toBe(3);
    expect(await db().inventoryAdjustment.count({ where: { orderId } })).toBe(1);
  });
  it("conversion racing with other buyers never lets stock go negative", async () => {
    const p = await makeProduct({ onHand: 6 });
    const orders = Array.from({ length: 3 }, () => randomUUID());
    for (const orderId of orders)
      await reserveStock({ lines: [line(p, 2)], orderId, ttlSeconds: 600 });
    const { other } = await race<unknown>(30, (i) =>
      i < 3
        ? convertReservations(orders[i] as string)
        : decrementStock({ lines: [line(p)], orderId: randomUUID() }),
    );
    expect(other).toEqual([]);
    expect(await onHandOf(p.id)).toBeGreaterThanOrEqual(0);
    expect((await db().stockReservation.findMany()).every((r) => r.status === "CONVERTED")).toBe(
      true,
    ); // all three paid orders were honored
  });
});
