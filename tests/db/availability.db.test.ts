import pg from "pg";
import { beforeEach, describe, expect, it } from "vitest";
import { bundleMaxSellable } from "@/domain/stock";
import { quoteBundle, type BundlePricing } from "@/domain/pricing";
import { fetchAvailability } from "@/server/repositories/catalog.repository";
import { db, makeBundle, makeProduct, makeReservation, resetData } from "./helpers";

beforeEach(resetData);

const availability = async (id: string) => (await fetchAvailability([id])).get(id);

/** Small seeded PRNG so the randomized tests are reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("product_availability: physical products", () => {
  it("is stock on hand minus ACTIVE, unexpired reservations", async () => {
    const p = await makeProduct({ onHand: 10 });
    await makeReservation({ productId: p.id, quantity: 3, expiresInMs: 600_000 }); // holds
    await makeReservation({ productId: p.id, quantity: 4, expiresInMs: -1_000 }); // expired: ignored
    await makeReservation({
      productId: p.id,
      quantity: 2,
      expiresInMs: 600_000,
      status: "CONVERTED",
    });
    await makeReservation({
      productId: p.id,
      quantity: 1,
      expiresInMs: 600_000,
      status: "RELEASED",
    });
    expect(await availability(p.id)).toBe(7);
  });
  it("is 0 with no inventory row, and never negative when over-reserved", async () => {
    const none = await makeProduct();
    expect(await availability(none.id)).toBe(0);
    const over = await makeProduct({ onHand: 2 });
    await makeReservation({ productId: over.id, quantity: 5, expiresInMs: 600_000 });
    expect(await availability(over.id)).toBe(0);
  });
  it("is NULL (not stock-tracked) for gift cards and digital products", async () => {
    const gift = await makeProduct({ type: "GIFT_CARD" });
    const digital = await makeProduct({ type: "DIGITAL" });
    expect(await availability(gift.id)).toBeNull();
    expect(await availability(digital.id)).toBeNull();
  });
});

describe("product_availability: bundles are derived, never stored", () => {
  it("is the minimum over floor(component available / quantity)", async () => {
    const cpu = await makeProduct({ onHand: 10 });
    const ram = await makeProduct({ onHand: 7 });
    const bundle = await makeBundle({
      components: [{ product: cpu }, { product: ram, quantity: 2 }],
    });
    expect(await availability(bundle.id)).toBe(3); // ram: floor(7 / 2)
    await db().inventory.update({ where: { productId: ram.id }, data: { onHand: 100 } });
    expect(await availability(bundle.id)).toBe(10); // now the cpu limits it
  });
  it("follows component reservations and expiry", async () => {
    const part = await makeProduct({ onHand: 5 });
    const bundle = await makeBundle({ components: [{ product: part }] });
    await makeReservation({ productId: part.id, quantity: 4, expiresInMs: 600_000 });
    expect(await availability(bundle.id)).toBe(1);
    await makeReservation({ productId: part.id, quantity: 1, expiresInMs: -5_000 });
    expect(await availability(bundle.id)).toBe(1); // the expired one does not count
  });
  it("is 0 when ANY component is archived, draft or soft-deleted", async () => {
    for (const change of [
      { status: "ARCHIVED" as const },
      { status: "DRAFT" as const },
      { deletedAt: new Date() },
    ]) {
      await resetData();
      const good = await makeProduct({ onHand: 9 });
      const other = await makeProduct({ onHand: 9 });
      const bundle = await makeBundle({ components: [{ product: good }, { product: other }] });
      expect(await availability(bundle.id)).toBe(9);
      await db().product.update({ where: { id: other.id }, data: change });
      expect(await availability(bundle.id), JSON.stringify(change)).toBe(0);
    }
  });
  it("is 0 for a bundle with no components", async () => {
    const empty = await makeBundle({ components: [] });
    expect(await availability(empty.id)).toBe(0);
  });
  it("PROPERTY: always equals the TypeScript bundleMaxSellable on random data", async () => {
    const rnd = mulberry32(77);
    for (let trial = 0; trial < 25; trial++) {
      await resetData();
      const parts: {
        p: Awaited<ReturnType<typeof makeProduct>>;
        quantity: number;
        onHand: number;
        status: "ACTIVE" | "ARCHIVED";
      }[] = [];
      for (let i = 0, n = 1 + Math.floor(rnd() * 4); i < n; i++) {
        const onHand = Math.floor(rnd() * 20);
        const status = rnd() < 0.15 ? ("ARCHIVED" as const) : ("ACTIVE" as const);
        const p = await makeProduct({ onHand, status });
        const reserved = Math.floor(rnd() * 6);
        if (reserved > 0)
          await makeReservation({
            productId: p.id,
            quantity: reserved,
            expiresInMs: rnd() < 0.3 ? -1000 : 600_000,
          });
        parts.push({ p, quantity: 1 + Math.floor(rnd() * 3), onHand, status });
      }
      const bundle = await makeBundle({
        components: parts.map((x) => ({ product: x.p, quantity: x.quantity })),
      });
      // independent TypeScript computation from the raw facts
      const map = new Map<string, { available: number; sellable: boolean }>();
      for (const x of parts) {
        const held = (
          await db().stockReservation.findMany({
            where: { productId: x.p.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
          })
        ).reduce((s, r) => s + r.quantity, 0);
        map.set(x.p.id, {
          available: Math.max(x.onHand - held, 0),
          sellable: x.status === "ACTIVE",
        });
      }
      const expected = bundleMaxSellable(
        parts.map((x) => ({ componentId: x.p.id, quantity: x.quantity })),
        map,
      );
      expect(await availability(bundle.id), `trial ${trial}`).toBe(expected);
    }
  });
});

describe("product_availability does not depend on the session time zone", () => {
  // A Windows PostgreSQL commonly defaults to the local zone (Cairo). Prisma stores UTC in `timestamp` columns, so a view
  // that compared with plain now() would see live reservations as expired (or dead ones as live) in such a session.
  it.each(["UTC", "Africa/Cairo", "America/Los_Angeles", "Pacific/Kiritimati", "Asia/Kolkata"])(
    "session zone %s",
    async (zone) => {
      const p = await makeProduct({ onHand: 10 });
      await makeReservation({ productId: p.id, quantity: 3, expiresInMs: 10 * 60_000 }); // live for another 10 minutes
      await makeReservation({ productId: p.id, quantity: 4, expiresInMs: -10 * 60_000 }); // expired 10 minutes ago
      const client = new pg.Client({
        connectionString: process.env["TEST_DATABASE_URL_RESOLVED"],
        options: `-c timezone=${zone}`,
      });
      await client.connect();
      try {
        const tz = (await client.query("SHOW timezone")).rows[0]?.TimeZone;
        expect(tz).toBe(zone);
        const row = (
          await client.query(
            'SELECT "available" FROM "product_availability" WHERE "productId" = $1',
            [p.id],
          )
        ).rows[0];
        expect(Number(row?.available)).toBe(7);
      } finally {
        await client.end();
      }
    },
  );
});

describe("product_pricing", () => {
  it("derives bundle prices from CURRENT component prices", async () => {
    const a = await makeProduct({ price: 12_000_00 });
    const b = await makeProduct({ price: 3_000_00 });
    const bundle = await makeBundle({
      components: [{ product: a }, { product: b, quantity: 2 }],
      mode: "DISCOUNT_PERCENT",
      bps: 1000,
    });
    const price = async () =>
      (
        await db().$queryRaw<
          { p: number; t: number }[]
        >`SELECT "effectivePrice"::int AS p, "listTotal"::int AS t FROM "product_pricing" WHERE "productId" = ${bundle.id}::uuid`
      )[0];
    expect(await price()).toEqual({ p: 16_200_00, t: 18_000_00 }); // 18,000 less 10%
    await db().product.update({ where: { id: a.id }, data: { price: 10_000_00 } });
    expect(await price()).toEqual({ p: 14_400_00, t: 16_000_00 }); // follows the component price change
  });
  it("physical products price as themselves; gift cards too", async () => {
    const p = await makeProduct({ price: 4_321_00 });
    const g = await makeProduct({ type: "GIFT_CARD", price: 500_00 });
    const rows = await db().$queryRaw<
      { productId: string; p: number }[]
    >`SELECT "productId", "effectivePrice"::int AS p FROM "product_pricing" WHERE "productId" = ANY(${[p.id, g.id]}::uuid[])`;
    expect(Object.fromEntries(rows.map((r) => [r.productId, r.p]))).toEqual({
      [p.id]: 4_321_00,
      [g.id]: 500_00,
    });
  });
  it("PROPERTY: always equals the TypeScript quoteBundle (including half-piastre rounding)", async () => {
    const rnd = mulberry32(2026);
    for (let trial = 0; trial < 40; trial++) {
      await resetData();
      const comps: {
        p: Awaited<ReturnType<typeof makeProduct>>;
        price: number;
        quantity: number;
      }[] = [];
      for (let i = 0, n = 1 + Math.floor(rnd() * 4); i < n; i++) {
        const price = Math.floor(rnd() * 5_000_00) + (rnd() < 0.5 ? 1 : 0); // odd piastres force rounding
        comps.push({ p: await makeProduct({ price }), price, quantity: 1 + Math.floor(rnd() * 3) });
      }
      const kind = Math.floor(rnd() * 3);
      const pricing: BundlePricing =
        kind === 0
          ? { mode: "FIXED", price: Math.floor(rnd() * 9_000_00) }
          : kind === 1
            ? {
                mode: "DISCOUNT_PERCENT",
                bps: [0, 1, 50, 333, 5000, 9999, 10_000][Math.floor(rnd() * 7)] ?? 0,
              }
            : { mode: "DISCOUNT_FIXED", amount: Math.floor(rnd() * 9_000_00) };
      const bundle = await makeBundle({
        components: comps.map((c) => ({ product: c.p, quantity: c.quantity })),
        mode: pricing.mode,
        ...(pricing.mode === "FIXED"
          ? { price: pricing.price }
          : pricing.mode === "DISCOUNT_PERCENT"
            ? { bps: pricing.bps }
            : { amount: pricing.amount }),
      });
      const expected = quoteBundle(
        pricing,
        comps.map((c) => ({ productId: c.p.id, quantity: c.quantity, unitPrice: c.price })),
      );
      const row = (
        await db().$queryRaw<
          { p: number; t: number }[]
        >`SELECT "effectivePrice"::int AS p, "listTotal"::int AS t FROM "product_pricing" WHERE "productId" = ${bundle.id}::uuid`
      )[0];
      expect({ p: row?.p, t: row?.t }, `trial ${trial} ${JSON.stringify(pricing)}`).toEqual({
        p: expected.price,
        t: expected.listTotal,
      });
    }
  });
});
