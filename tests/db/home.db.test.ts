import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HOME_RAILS, HOME_RAIL_SIZE } from "@/domain/home";
import { cardSavings } from "@/domain/listing";
import { clearCategoryCaches, getCategoryTree } from "@/server/services/category.service";
import { type HomeData, getHomeData } from "@/server/services/home.service";
import { LocalStorageProvider } from "@/server/storage/local";
import { runSeed } from "../../prisma/seed/run";
import { db, resetData } from "./helpers";

let dir: string;
let home: HomeData;

beforeAll(async () => {
  await resetData();
  dir = await mkdtemp(join(tmpdir(), "home-test-"));
  await runSeed({ storage: new LocalStorageProvider(dir, "/uploads", { allowSvg: true }) });
  clearCategoryCaches();
  home = await getHomeData();
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const metaOf = async (ids: string[]) => {
  const rows = await db().product.findMany({
    where: { id: { in: ids } },
    select: { id: true, unitsSold: true, viewCount: true, createdAt: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => {
    const r = byId.get(id);
    if (!r) throw new Error(`missing product ${id}`);
    return r;
  });
};

const nonIncreasing = (values: number[]) => values.every((v, i) => i === 0 || v <= values[i - 1]!);

describe("home: product rails", () => {
  it("fills every rail from the seed, none above the rail size", () => {
    for (const key of HOME_RAILS) {
      expect(home.rails[key].length, key).toBeGreaterThan(0);
      expect(home.rails[key].length, key).toBeLessThanOrEqual(HOME_RAIL_SIZE);
    }
  });

  it("offers only products that can be bought: every card is in stock", () => {
    for (const key of HOME_RAILS)
      for (const p of home.rails[key])
        expect(p.available === null || p.available > 0, `${key}: ${p.slug}`).toBe(true);
    if (home.hero) expect(home.hero.product.available).toBeGreaterThan(0);
  });

  it("best sellers are ordered by units sold", async () => {
    const meta = await metaOf(home.rails.bestSellers.map((p) => p.id));
    expect(nonIncreasing(meta.map((m) => m.unitsSold))).toBe(true);
    // And it really is the top: nothing in stock outside the rail sold more than the rail's last item.
    const last = meta.at(-1)?.unitsSold ?? 0;
    const outside = await db().$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM "product" p
      JOIN "product_availability" av ON av."productId" = p."id"
      WHERE p."status" = 'ACTIVE' AND p."deletedAt" IS NULL AND (av."available" IS NULL OR av."available" > 0)
        AND p."unitsSold" > ${last} AND p."id" <> ALL(${home.rails.bestSellers.map((p) => p.id)}::uuid[])`;
    expect(outside[0]?.n).toBe(0);
  });

  it("most viewed are ordered by views, new arrivals by creation date (newest first)", async () => {
    const viewed = await metaOf(home.rails.mostViewed.map((p) => p.id));
    expect(nonIncreasing(viewed.map((m) => m.viewCount))).toBe(true);
    const fresh = await metaOf(home.rails.newArrivals.map((p) => p.id));
    expect(nonIncreasing(fresh.map((m) => m.createdAt.getTime()))).toBe(true);
  });

  it("deals all carry a real saving, biggest percentage first", () => {
    const deals = home.rails.deals;
    const percents = deals.map((p) => cardSavings(p)?.percent);
    expect(percents.every((x) => x !== undefined && x > 0)).toBe(true);
    expect(nonIncreasing(percents as number[])).toBe(true);
  });

  it("featured products carry the featured tag", async () => {
    const ids = [
      ...home.rails.featured.map((p) => p.id),
      ...(home.hero ? [home.hero.product.id] : []),
    ];
    const tagged = await db().productTag.count({
      where: { productId: { in: ids }, tag: { slug: "featured" } },
    });
    expect(tagged).toBe(ids.length);
  });
});

describe("home: hero bundle", () => {
  it("is a featured bundle with its full parts list, and is not repeated in the Featured rail", async () => {
    expect(home.hero).not.toBeNull();
    const hero = home.hero!;
    expect(hero.product.type).toBe("BUNDLE");
    expect(home.rails.featured.some((p) => p.id === hero.product.id)).toBe(false);
    const stored = await db().bundleItem.count({ where: { bundleId: hero.product.id } });
    expect(hero.parts).toHaveLength(stored);
    expect(hero.parts.every((p) => p.quantity >= 1 && p.title.en && p.title.ar)).toBe(true);
  });
});

describe("home: categories and brands", () => {
  it("category tiles are the storefront tree's top level", async () => {
    const tree = await getCategoryTree();
    expect(home.categories.map((c) => c.path)).toEqual(tree.map((c) => c.path));
    expect(home.categories.every((c) => c.productCount > 0 && c.image)).toBe(true);
  });

  it("every brand link points at a top-level category that exists, and counts match the database", async () => {
    const tree = new Set((await getCategoryTree()).map((c) => c.path));
    expect(home.brands.length).toBeGreaterThan(5);
    for (const b of home.brands) {
      expect(b.categoryPath, b.slug).not.toBeNull();
      expect(tree.has(b.categoryPath as string), b.slug).toBe(true);
    }
    const sample = home.brands[0]!;
    const direct = await db().$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM "product" p
      JOIN "category" c ON c."id" = p."categoryId" JOIN "brand" b ON b."id" = p."brandId"
      WHERE b."slug" = ${sample.slug} AND p."status" = 'ACTIVE' AND p."deletedAt" IS NULL AND c."isActive" AND b."isActive"`;
    expect(sample.productCount).toBe(direct[0]?.n);
    // Sorted by product count, most first.
    expect(nonIncreasing(home.brands.map((b) => b.productCount))).toBe(true);
  });
});

describe("home: visibility", () => {
  it("an archived product disappears from every rail and lowers its brand's count in the strip", async () => {
    // A best seller whose brand is in the strip (the strip shows the 14 biggest brands, so not every brand is).
    const stripSlugs = new Set(home.brands.map((b) => b.slug));
    const victim = home.rails.bestSellers.find((p) => p.brand && stripSlugs.has(p.brand.slug));
    expect(victim, "a best seller from a stripped brand").toBeDefined();
    const brandSlug = victim!.brand!.slug;
    const before = home.brands.find((b) => b.slug === brandSlug)!.productCount;
    await db().product.update({ where: { id: victim!.id }, data: { status: "ARCHIVED" } });
    try {
      clearCategoryCaches();
      const after = await getHomeData();
      for (const key of HOME_RAILS)
        expect(
          after.rails[key].some((p) => p.id === victim!.id),
          key,
        ).toBe(false);
      // The count drops by one (a brand left with no visible product leaves the strip).
      expect(after.brands.find((b) => b.slug === brandSlug)?.productCount ?? 0).toBe(before - 1);
    } finally {
      await db().product.update({ where: { id: victim!.id }, data: { status: "ACTIVE" } });
      clearCategoryCaches();
    }
  });
});
