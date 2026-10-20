import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyzeBuild, roleOfCategoryPath, type BuildPart } from "@/domain/compatibility";
import { getBundleDetail, listStorefrontProducts } from "@/server/services/catalog.service";
import { fetchAvailability } from "@/server/repositories/catalog.repository";
import { LocalStorageProvider } from "@/server/storage/local";
import { loadSeedData } from "../../prisma/seed/data";
import { changesIn, runSeed, type SeedReport } from "../../prisma/seed/run";
import { db, resetData } from "./helpers";

const data = loadSeedData();
let dir: string;
let storage: LocalStorageProvider;
let first: SeedReport;

/** Every row of every table, as JSON, in a stable order: the strictest possible "nothing changed" check. */
async function snapshot(): Promise<Record<string, string[]>> {
  const client = db();
  const tables = await client.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\\_prisma%' ORDER BY 1`;
  const out: Record<string, string[]> = {};
  for (const { tablename } of tables) {
    const rows = await client.$queryRawUnsafe<{ j: string }[]>(
      `SELECT to_jsonb(t)::text AS j FROM "${tablename}" t ORDER BY 1`,
    );
    out[tablename] = rows.map((r) => r.j);
  }
  return out;
}

const idOfSku = async (sku: string) =>
  (await db().product.findFirstOrThrow({ where: { sku, deletedAt: null }, select: { id: true } }))
    .id;

beforeAll(async () => {
  await resetData();
  dir = await mkdtemp(join(tmpdir(), "seed-test-"));
  storage = new LocalStorageProvider(dir, "/uploads", { allowSvg: true });
  first = await runSeed({ storage });
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("seed: idempotency", () => {
  it("the first run creates the catalog", () => {
    expect(first.entities.products.created).toBe(data.products.length);
    expect(first.entities.bundles.created).toBe(data.bundles.length);
    expect(first.entities.categories.created).toBe(data.categories.length);
    expect(first.entities.bundleItems.created).toBe(
      data.bundles.reduce((n, b) => n + b.items.length, 0),
    );
  });

  it("running the seed twice changes nothing: same rows, same ids, same timestamps", async () => {
    const before = await snapshot();
    const second = await runSeed({ storage });
    const after = await snapshot();
    expect(changesIn(second)).toBe(0);
    expect(after).toEqual(before);
  });

  it("a third run is still a no-op", async () => {
    const before = await snapshot();
    expect(changesIn(await runSeed({ storage }))).toBe(0);
    expect(await snapshot()).toEqual(before);
  });

  it("repairs seed-managed fields that drifted, but never resets stock or counters", async () => {
    const sku = "CPU-AMD-R5-7600";
    const id = await idOfSku(sku);
    await db().product.update({
      where: { id },
      data: { price: 123, titleEn: "Edited", viewCount: 999_999, unitsSold: 888_888 },
    });
    await db().inventory.update({ where: { productId: id }, data: { onHand: 1 } });
    const adjustmentsBefore = await db().inventoryAdjustment.count();

    const report = await runSeed({ storage });
    expect(report.entities.products.updated).toBe(1);
    expect(changesIn(report)).toBe(1);

    const row = await db().product.findUniqueOrThrow({ where: { id } });
    const seeded = data.products.find((p) => p.sku === sku);
    expect(row.price).toBe((seeded?.priceEgp ?? 0) * 100);
    expect(row.titleEn).toBe(seeded?.title.en);
    expect(row.viewCount).toBe(999_999); // live counters survive
    expect(row.unitsSold).toBe(888_888);
    expect((await db().inventory.findUniqueOrThrow({ where: { productId: id } })).onHand).toBe(1);
    expect(await db().inventoryAdjustment.count()).toBe(adjustmentsBefore);
  });

  it("restores a bundle's composition when it was edited", async () => {
    const bundle = await db().product.findFirstOrThrow({ where: { sku: "BND-OFFICE-HOME" } });
    await db().bundleItem.deleteMany({ where: { bundleId: bundle.id } });
    const report = await runSeed({ storage });
    expect(report.entities.bundleItems.created).toBe(6);
    expect(await db().bundleItem.count({ where: { bundleId: bundle.id } })).toBe(6);
  });
});

describe("seed: catalog data only", () => {
  it("writes only catalog tables (no users, orders, reviews or settings)", async () => {
    const snap = await snapshot();
    const filled = Object.entries(snap)
      .filter(([, rows]) => rows.length > 0)
      .map(([table]) => table)
      .sort();
    expect(filled).toEqual(
      [
        "brand",
        "bundle_item",
        "category",
        "inventory",
        "inventory_adjustment",
        "product",
        "product_image",
        "product_tag",
        "showcase_block",
        "spec_definition",
        "tag",
      ].sort(),
    );
  });

  it("writes one RECEIVED adjustment per in-stock product and none for out-of-stock ones", async () => {
    const inStock = data.products.filter((p) => p.stock > 0).length;
    expect(await db().inventoryAdjustment.count()).toBe(inStock);
    expect(await db().inventoryAdjustment.count({ where: { reason: { not: "RECEIVED" } } })).toBe(
      0,
    );
  });
});

describe("seed: product data", () => {
  it("seeds the volumes the brief asks for", () => {
    expect(data.products.length).toBeGreaterThanOrEqual(60);
    expect(data.products.length).toBeLessThanOrEqual(80);
    expect(data.bundles.length).toBeGreaterThanOrEqual(5);
    expect(data.bundles.length).toBeLessThanOrEqual(8);
    expect(data.brands.length).toBeGreaterThanOrEqual(15);
  });

  it("covers the states the storefront needs to test: low stock, out of stock, discounts, varied counters", async () => {
    const ids = await Promise.all(data.products.map((p) => idOfSku(p.sku)));
    const avail = await fetchAvailability(ids);
    const units = ids.map((id) => avail.get(id) ?? 0);
    expect(units.filter((u) => u === 0).length).toBeGreaterThanOrEqual(3);
    const low = await db().$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "product" p JOIN "product_availability" a ON a."productId" = p."id"
      WHERE p."type" = 'PHYSICAL' AND a."available" > 0 AND a."available" <= p."lowStockThreshold"`;
    expect(low[0]?.n).toBeGreaterThanOrEqual(3);
    expect(data.products.filter((p) => p.compareAtEgp).length).toBeGreaterThanOrEqual(10);
    // "Most viewed" and "best sellers" need an unambiguous top 10 (no ties) to be testable.
    for (const field of ["views", "sold"] as const) {
      const top = data.products
        .map((p) => p[field])
        .sort((a, b) => b - a)
        .slice(0, 10);
      expect(new Set(top).size, field).toBe(10);
    }
  });

  it("every product has two images that were written to storage", async () => {
    const rows = await db().productImage.findMany({ select: { storageKey: true } });
    expect(rows.length).toBe((data.products.length + data.bundles.length) * 2);
    const keys = rows.map((r) => r.storageKey);
    for (const key of keys.slice(0, 3)) expect(await storage.exists(key)).toBe(true);
    const written = await readdir(join(dir, "seed", "products"));
    expect(written.length).toBe(keys.length);
  });

  it("every seeded part is a build part with all the specs the compatibility rules need", async () => {
    const rows = await db().product.findMany({
      where: { type: "PHYSICAL", category: { path: { startsWith: "components/" } } },
      select: { sku: true, specs: true, category: { select: { path: true } } },
    });
    expect(rows.length).toBeGreaterThan(40);
    for (const r of rows) {
      const role = roleOfCategoryPath(r.category.path);
      if (r.category.path.endsWith("case-fans")) {
        expect(role).toBeNull();
        continue;
      }
      expect(role, r.sku).not.toBeNull();
    }
  });
});

describe("seed: bundles", () => {
  it.each(data.bundles.map((b) => [b.sku, b] as const))(
    "%s is compatible with no warnings and no unknowns, saves money and is sellable",
    async (sku) => {
      const detail = await getBundleDetail(await idOfSku(sku), { includeMargin: true });
      expect(detail.compatibility.issues, JSON.stringify(detail.compatibility.issues)).toEqual([]);
      expect(detail.compatibility.compatible).toBe(true);
      expect(detail.compatibility.strictOk).toBe(true);
      expect(detail.quote.savings).toBeGreaterThan(0);
      expect(detail.quote.savings / (detail.quote.price + detail.quote.savings)).toBeLessThan(0.15);
      expect(detail.available).toBeGreaterThan(0);
      expect(detail.status).toBe("ACTIVE");
      expect(detail.margin?.costKnown).toBe(true);
      expect(detail.margin?.margin ?? 0).toBeGreaterThan(0);
    },
  );

  it("bundle availability is derived: the high-end bundle is limited by its scarcest part", async () => {
    const detail = await getBundleDetail(await idOfSku("BND-HIGHEND-4K"));
    const parts = Math.min(
      ...detail.components.map((c) => Math.floor((c.available ?? 0) / c.quantity)),
    );
    expect(detail.available).toBe(parts);
    expect(detail.available).toBeLessThanOrEqual(2);
  });

  it("components are all active physical products and no bundle nests another", async () => {
    const items = await db().bundleItem.findMany({ include: { component: true } });
    for (const i of items) {
      expect(i.component.type).toBe("PHYSICAL");
      expect(i.component.status).toBe("ACTIVE");
      expect(i.component.deletedAt).toBeNull();
    }
  });
});

describe("seed: storefront listing", () => {
  it("lists physical products and bundles together", async () => {
    const rows = await listStorefrontProducts({ limit: 100 });
    expect(rows.length).toBe(data.products.length + data.bundles.length);
  });
});

describe("seed: nothing crosses a bundle part boundary by accident", () => {
  it("a full build from loose parts also passes the rules (what the PC Builder will reuse)", () => {
    const parts: BuildPart[] = [];
    const pick = (sku: string, role: BuildPart["role"]) => {
      const p = data.products.find((x) => x.sku === sku);
      if (p) parts.push({ role, quantity: 1, specs: p.specs });
    };
    pick("CPU-AMD-R7-9700X", "cpu");
    pick("MB-ASUS-TUF-B650-PLUS-WIFI", "motherboard");
    pick("RAM-CORSAIR-VENGEANCE-D5-32G-6000", "ram");
    pick("GPU-ASUS-PRIME-RTX5070-O12G", "gpu");
    pick("SSD-SAMSUNG-990PRO-2TB", "storage");
    pick("PSU-MSI-MAG-A850GL-PCIE5", "psu");
    pick("CASE-LIANLI-LANCOOL-216", "case");
    pick("COOL-NOCTUA-NH-D15", "cooler");
    expect(analyzeBuild(parts).compatible).toBe(true);
  });
});
