import { randomUUID } from "node:crypto";
import pg from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBundleDetail,
  getAvailability,
  listStorefrontProducts,
} from "@/server/services/catalog.service";
import { reserveStock } from "@/server/services/inventory.service";
import { db, makeBundle, makeProduct, resetData } from "./helpers";

beforeEach(resetData);

/** A realistic, mutually compatible AM5 gaming build, one product per role. */
async function build() {
  const cpu = await makeProduct({
    categoryPath: "components/cpus/amd-ryzen",
    price: 12_000_00,
    cost: 10_000_00,
    onHand: 5,
    specs: { socket: "AM5", tdp_w: 65 },
  });
  const board = await makeProduct({
    categoryPath: "components/motherboards",
    price: 6_000_00,
    cost: 5_000_00,
    onHand: 4,
    specs: {
      socket: "AM5",
      form_factor: "ATX",
      memory_type: "DDR5",
      memory_slots: 4,
      max_memory_gb: 192,
      m2_slots: 3,
    },
  });
  const ram = await makeProduct({
    categoryPath: "components/memory/ddr5",
    price: 3_000_00,
    cost: 2_400_00,
    onHand: 9,
    specs: { memory_type: "DDR5", capacity_gb: 32, modules: 2 },
  });
  const gpu = await makeProduct({
    categoryPath: "components/graphics-cards/nvidia-geforce",
    price: 18_000_00,
    cost: 15_000_00,
    onHand: 3,
    specs: { tdp_w: 115, length_mm: 240, recommended_psu_w: 550 },
  });
  const psu = await makeProduct({
    categoryPath: "components/power-supplies",
    price: 2_500_00,
    cost: 2_000_00,
    onHand: 6,
    specs: { wattage_w: 650, form_factor: "ATX" },
  });
  const pcCase = await makeProduct({
    categoryPath: "components/cases",
    price: 2_000_00,
    cost: 1_500_00,
    onHand: 7,
    specs: {
      form_factors: ["ATX", "mATX"],
      max_gpu_length_mm: 360,
      max_cooler_height_mm: 165,
      psu_form_factors: ["ATX"],
      radiator_support_mm: [240],
    },
  });
  const cooler = await makeProduct({
    categoryPath: "components/cooling/air-coolers",
    price: 1_000_00,
    cost: 700_00,
    onHand: 8,
    specs: { cooler_type: "air", sockets: ["AM5", "AM4"], height_mm: 155, tdp_rating_w: 180 },
  });
  const ssd = await makeProduct({
    categoryPath: "components/storage/nvme-ssds",
    price: 2_500_00,
    cost: 2_000_00,
    onHand: 10,
    specs: { interface: "NVMe", form_factor: "M.2 2280" },
  });
  return {
    cpu,
    board,
    ram,
    gpu,
    psu,
    pcCase,
    cooler,
    ssd,
    all: [cpu, board, ram, gpu, psu, pcCase, cooler, ssd],
  };
}
// list total = 12,000 + 6,000 + 3,000 + 18,000 + 2,500 + 2,000 + 1,000 + 2,500 = 47,000 EGP

describe("getBundleDetail", () => {
  it("returns components, a derived quote, derived stock and a compatibility verdict", async () => {
    const parts = await build();
    const bundle = await makeBundle({
      components: parts.all.map((product) => ({ product })),
      mode: "FIXED",
      price: 43_000_00,
    });
    const detail = await getBundleDetail(bundle.id);
    expect(detail.components).toHaveLength(8);
    expect(detail.components.map((c) => c.componentId)).toEqual(parts.all.map((p) => p.id)); // keeps the curated order
    expect(detail.quote).toMatchObject({
      listTotal: 47_000_00,
      price: 43_000_00,
      savings: 4_000_00,
      warnings: [],
    });
    expect(detail.available).toBe(3); // limited by the GPU
    expect(detail.compatibility.compatible).toBe(true);
    expect(detail.compatibility.strictOk).toBe(true);
    expect(detail.compatibility.issues).toEqual([]);
    expect(detail.margin).toBeUndefined(); // costs never leak unless an admin asks
  });
  it("recomputes 'you save' when a component price changes", async () => {
    const parts = await build();
    const bundle = await makeBundle({
      components: parts.all.map((product) => ({ product })),
      mode: "DISCOUNT_FIXED",
      amount: 3_000_00,
    });
    expect((await getBundleDetail(bundle.id)).quote).toMatchObject({
      listTotal: 47_000_00,
      price: 44_000_00,
      savings: 3_000_00,
    });
    await db().product.update({ where: { id: parts.gpu.id }, data: { price: 16_000_00 } });
    expect((await getBundleDetail(bundle.id)).quote).toMatchObject({
      listTotal: 45_000_00,
      price: 42_000_00,
      savings: 3_000_00,
    });
  });
  it("includes the margin for admins, and says so when a cost is unknown", async () => {
    const parts = await build();
    const bundle = await makeBundle({
      components: parts.all.map((product) => ({ product })),
      mode: "FIXED",
      price: 43_000_00,
    });
    const withCosts = await getBundleDetail(bundle.id, { includeMargin: true });
    expect(withCosts.margin).toEqual({
      costKnown: true,
      cost: 38_600_00,
      margin: 4_400_00,
      marginBps: 1023,
    });
    await db().product.update({ where: { id: parts.ram.id }, data: { cost: null } });
    expect((await getBundleDetail(bundle.id, { includeMargin: true })).margin?.costKnown).toBe(
      false,
    );
  });
  it("flags an incompatible swap and reports which rule failed", async () => {
    const parts = await build();
    const bundle = await makeBundle({ components: parts.all.map((product) => ({ product })) });
    await db().product.update({
      where: { id: parts.cpu.id },
      data: { specs: { socket: "LGA1700", tdp_w: 65 } },
    });
    const detail = await getBundleDetail(bundle.id);
    expect(detail.compatibility.compatible).toBe(false);
    expect(detail.compatibility.issues.map((i) => i.rule)).toContain("cpu_socket");
  });
  it("stock follows reservations on any component", async () => {
    const parts = await build();
    const bundle = await makeBundle({ components: parts.all.map((product) => ({ product })) });
    await reserveStock({
      lines: [{ productId: parts.gpu.id, quantity: 2 }],
      orderId: randomUUID(),
      ttlSeconds: 600,
    });
    expect((await getBundleDetail(bundle.id)).available).toBe(1);
  });
  it("is 'not found' for non-bundles, unknown ids and deleted bundles", async () => {
    const parts = await build();
    const bundle = await makeBundle({ components: parts.all.map((product) => ({ product })) });
    await expect(getBundleDetail(parts.cpu.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getBundleDetail(randomUUID())).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db().product.update({ where: { id: bundle.id }, data: { deletedAt: new Date() } });
    await expect(getBundleDetail(bundle.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("getAvailability", () => {
  it("answers for many products in one call, with null for untracked ones", async () => {
    const a = await makeProduct({ onHand: 4 });
    const gift = await makeProduct({ type: "GIFT_CARD" });
    const map = await getAvailability([a.id, gift.id, randomUUID()]);
    expect(map.get(a.id)).toBe(4);
    expect(map.get(gift.id)).toBeNull();
    expect(map.size).toBe(2); // an unknown id is simply absent
  });
});

describe("listStorefrontProducts", () => {
  it("lists only sellable-state products, with derived bundle price and stock", async () => {
    const live = await makeProduct({
      categoryPath: "components/cpus",
      price: 5_000_00,
      onHand: 2,
      compareAtPrice: 6_000_00,
    });
    await makeProduct({ categoryPath: "components/cpus", status: "DRAFT", onHand: 9 });
    await makeProduct({ categoryPath: "components/cpus", status: "ARCHIVED", onHand: 9 });
    await makeProduct({ categoryPath: "components/cpus", deletedAt: new Date(), onHand: 9 });
    const part = await makeProduct({
      categoryPath: "components/memory",
      price: 1_000_00,
      onHand: 9,
    });
    const bundle = await makeBundle({
      components: [{ product: live }, { product: part, quantity: 2 }],
      mode: "DISCOUNT_PERCENT",
      bps: 1000,
    });

    const rows = await listStorefrontProducts();
    expect(rows.map((r) => r.id).sort()).toEqual([live.id, part.id, bundle.id].sort());
    const b = rows.find((r) => r.id === bundle.id);
    expect(b).toMatchObject({
      type: "BUNDLE",
      listTotal: 7_000_00,
      effectivePrice: 6_300_00,
      available: 2,
    });
    expect(rows.find((r) => r.id === live.id)).toMatchObject({
      effectivePrice: 5_000_00,
      compareAtPrice: 6_000_00,
      available: 2,
    });
  });
  it("filters by category path prefix, matching the category and its descendants but not look-alikes", async () => {
    const root = await makeProduct({ categoryPath: "components/cpus", onHand: 1 });
    const nested = await makeProduct({ categoryPath: "components/cpus/amd-ryzen", onHand: 1 });
    await makeProduct({ categoryPath: "components/cpus-extra", onHand: 1 });
    await makeProduct({ categoryPath: "components/memory", onHand: 1 });
    const ids = (await listStorefrontProducts({ categoryPath: "components/cpus" }))
      .map((r) => r.id)
      .sort();
    expect(ids).toEqual([root.id, nested.id].sort());
    expect(await listStorefrontProducts({ categoryPath: "components/nothing" })).toEqual([]);
  });
  it("can hide out-of-stock products (gift cards stay: they are not stock-tracked)", async () => {
    await makeProduct({ onHand: 0 });
    const inStock = await makeProduct({ onHand: 3 });
    const gift = await makeProduct({ type: "GIFT_CARD" });
    const ids = (await listStorefrontProducts({ inStockOnly: true })).map((r) => r.id).sort();
    expect(ids).toEqual([inStock.id, gift.id].sort());
  });
  it("paginates newest first with a stable order, and caps the page size", async () => {
    for (let i = 0; i < 5; i++) await makeProduct({ onHand: 1 });
    const page1 = await listStorefrontProducts({ limit: 2, offset: 0 });
    const page2 = await listStorefrontProducts({ limit: 2, offset: 2 });
    const page3 = await listStorefrontProducts({ limit: 2, offset: 4 });
    const all = [...page1, ...page2, ...page3].map((r) => r.id);
    expect(new Set(all).size).toBe(5);
    expect(page3).toHaveLength(1);
    expect(await listStorefrontProducts({ limit: 100_000 })).toHaveLength(5);
  });
  it("is ONE database statement however many bundles it returns (no N+1)", async () => {
    const parts: Awaited<ReturnType<typeof makeProduct>>[] = [];
    for (let i = 0; i < 12; i++) parts.push(await makeProduct({ onHand: 5 }));
    for (let i = 0; i < 10; i++)
      await makeBundle({
        components: [
          { product: parts[i % 12] as { id: string } },
          { product: parts[(i + 1) % 12] as { id: string } },
        ],
      });
    const spy = vi.spyOn(pg.Client.prototype, "query");
    try {
      const rows = await listStorefrontProducts({ limit: 50 });
      expect(rows).toHaveLength(22);
      expect(spy.mock.calls.length).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
});
