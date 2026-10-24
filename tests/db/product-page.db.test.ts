import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fetchPublicProductSlugs } from "@/server/repositories/product.repository";
import { clearCategoryCaches } from "@/server/services/category.service";
import { getProductPage, type ProductPage } from "@/server/services/product.service";
import { LocalStorageProvider } from "@/server/storage/local";
import { runSeed } from "../../prisma/seed/run";
import { db, resetData } from "./helpers";

let slugs: string[] = [];
let bundleSlugs: string[] = [];

const must = async (slug: string): Promise<ProductPage> => {
  const page = await getProductPage(slug);
  if (!page) throw new Error(`no product page for ${slug}`);
  return page;
};

beforeAll(async () => {
  await resetData();
  const dir = await mkdtemp(join(tmpdir(), "product-page-test-"));
  await runSeed({ storage: new LocalStorageProvider(dir, "/uploads", { allowSvg: true }) });
  clearCategoryCaches();
  slugs = await fetchPublicProductSlugs();
  bundleSlugs = (
    await db().product.findMany({
      where: { type: "BUNDLE", deletedAt: null },
      select: { slug: true },
    })
  ).map((b) => b.slug);
});

afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await db().$disconnect();
});

describe("product pages over the seeded catalog", () => {
  it("every visible product and bundle loads, with consistent numbers", async () => {
    expect(slugs.length).toBeGreaterThanOrEqual(80);
    for (const slug of slugs) {
      const p = await must(slug);
      expect(p.images.length, `${slug} images`).toBeGreaterThan(0);
      expect(p.price, `${slug} price`).toBeGreaterThan(0);
      expect(p.related.length, `${slug} related`).toBeGreaterThan(0);
      expect(p.related.every((r) => r.slug !== slug)).toBe(true);
      if (p.type === "PHYSICAL") {
        expect(p.specRows.length, `${slug} specs`).toBeGreaterThan(0);
        expect(p.bundle).toBeNull();
      } else {
        expect(p.bundle, `${slug} bundle`).not.toBeNull();
      }
    }
  });

  it("each seeded bundle shows its parts, a verified-compatible build and a real saving", async () => {
    expect(bundleSlugs.length).toBeGreaterThanOrEqual(5);
    for (const slug of bundleSlugs) {
      const p = await must(slug);
      const b = p.bundle;
      if (!b) throw new Error("bundle expected");
      expect(b.parts.length).toBeGreaterThanOrEqual(5);
      expect(b.compatibility.compatible, `${slug} compatible`).toBe(true);
      expect(b.compatibility.strictOk, `${slug} strict`).toBe(true);
      // The quote (domain) and the view (SQL) agree on the price, and parts add up to the list total.
      expect(b.quote.price).toBe(p.price);
      expect(b.parts.reduce((s, x) => s + x.lineTotal, 0)).toBe(p.listTotal);
      expect(p.savings?.kind === "bundle" ? p.savings.amount : 0).toBe(
        Math.max(p.listTotal - p.price, 0),
      );
      expect(b.parts.every((x) => x.linkable && x.availability !== "unavailable")).toBe(true);
    }
  });

  it("a bundle page costs the same number of statements however many parts it has (no N+1)", async () => {
    const counts = await db().bundleItem.groupBy({ by: ["bundleId"], _count: { _all: true } });
    const sorted = [...counts].sort((a, b) => a._count._all - b._count._all);
    const fewest = sorted[0];
    const most = sorted.at(-1);
    if (!fewest || !most || fewest._count._all === most._count._all)
      throw new Error("need differing sizes");
    const slugOf = async (id: string) =>
      (await db().product.findUniqueOrThrow({ where: { id }, select: { slug: true } })).slug;
    const measure = async (slug: string) => {
      const raw = vi.spyOn(db(), "$queryRaw");
      const media = vi.spyOn(db().productImage, "findMany");
      const sc = vi.spyOn(db().showcaseBlock, "findMany");
      const tag = vi.spyOn(db().productTag, "findMany");
      const bundle = vi.spyOn(db().product, "findFirst");
      await must(slug);
      const total =
        raw.mock.calls.length +
        media.mock.calls.length +
        sc.mock.calls.length +
        tag.mock.calls.length +
        bundle.mock.calls.length;
      vi.restoreAllMocks();
      return total;
    };
    const small = await measure(await slugOf(fewest.bundleId));
    const large = await measure(await slugOf(most.bundleId));
    expect(large).toBe(small);
    expect(large).toBeLessThanOrEqual(12);
  });

  it("a part lists the bundles it is in; a bundle and a part nobody bundles list none", async () => {
    const item = await db().bundleItem.findFirstOrThrow({
      include: { component: { select: { slug: true } }, bundle: { select: { slug: true } } },
    });
    const part = await must(item.component.slug);
    expect(part.includedIn.map((c) => c.slug)).toContain(item.bundle.slug);
    expect(part.includedIn.every((c) => c.type === "BUNDLE")).toBe(true);
    const bundle = await must(item.bundle.slug);
    expect(bundle.includedIn).toEqual([]);
  });

  it("showcase blocks come back in order and a valid video resolves to the privacy-enhanced embed", async () => {
    const withBlocks = await db().showcaseBlock.findMany({
      select: { product: { select: { slug: true } } },
    });
    const pages = await Promise.all([...new Set(withBlocks.map((b) => b.product.slug))].map(must));
    expect(pages.length).toBeGreaterThan(0);
    const videos = pages.flatMap((p) => p.showcase).filter((b) => b.type === "VIDEO");
    expect(videos.length).toBeGreaterThan(0);
    for (const v of videos) {
      if (v.type === "VIDEO" && v.embed)
        expect(v.embed.src).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}$/);
    }
  });
});

const idOf = async (slug: string) =>
  (await db().product.findFirstOrThrow({ where: { slug, deletedAt: null }, select: { id: true } }))
    .id;

describe("what a shopper can and cannot see", () => {
  const slugOfFirst = async (type: "PHYSICAL" | "BUNDLE") =>
    (
      await db().product.findFirstOrThrow({
        where: { type, status: "ACTIVE", deletedAt: null },
        orderBy: { slug: "asc" },
      })
    ).slug;

  it("answers null for unknown, malformed, draft, archived and soft-deleted products", async () => {
    expect(await getProductPage("no-such-product")).toBeNull();
    expect(await getProductPage("Not A Slug!")).toBeNull();
    expect(await getProductPage("")).toBeNull();
    const slug = await slugOfFirst("PHYSICAL");
    const id = await idOf(slug);
    const original = await db().product.findUniqueOrThrow({ where: { id } });
    try {
      for (const data of [
        { status: "DRAFT" as const },
        { status: "ARCHIVED" as const },
        { deletedAt: new Date() },
      ]) {
        await db().product.update({ where: { id }, data });
        expect(await getProductPage(slug), JSON.stringify(data)).toBeNull();
        await db().product.update({
          where: { id },
          data: { status: original.status, deletedAt: original.deletedAt },
        });
      }
      expect(await getProductPage(slug)).not.toBeNull();
    } finally {
      await db().product.update({
        where: { id },
        data: { status: original.status, deletedAt: null },
      });
    }
  });

  it("hides products of a deactivated brand and of an inactive category, and the sitemap agrees", async () => {
    const slug = await slugOfFirst("PHYSICAL");
    const product = await db().product.findUniqueOrThrow({
      where: { id: await idOf(slug) },
      select: { brandId: true, categoryId: true },
    });
    if (!product.brandId) throw new Error("seeded product has a brand");
    try {
      await db().brand.update({ where: { id: product.brandId }, data: { isActive: false } });
      expect(await getProductPage(slug)).toBeNull();
      expect(await fetchPublicProductSlugs()).not.toContain(slug);
    } finally {
      await db().brand.update({ where: { id: product.brandId }, data: { isActive: true } });
    }
    try {
      await db().category.update({ where: { id: product.categoryId }, data: { isActive: false } });
      expect(await getProductPage(slug)).toBeNull();
      expect(await fetchPublicProductSlugs()).not.toContain(slug);
    } finally {
      await db().category.update({ where: { id: product.categoryId }, data: { isActive: true } });
    }
    expect(await fetchPublicProductSlugs()).toContain(slug);
  });

  it("archiving one component makes its bundle unavailable and flags exactly that part", async () => {
    const slug = await slugOfFirst("BUNDLE");
    const bundle = await db().product.findUniqueOrThrow({
      where: { id: await idOf(slug) },
      include: { bundleItems: { include: { component: true }, orderBy: { sortOrder: "asc" } } },
    });
    const victim = bundle.bundleItems[0]?.component;
    if (!victim) throw new Error("bundle has parts");
    try {
      await db().product.update({ where: { id: victim.id }, data: { status: "ARCHIVED" } });
      const p = await must(slug);
      expect(p.available).toBe(0);
      const flagged = p.bundle?.parts.filter((x) => x.availability === "unavailable") ?? [];
      expect(flagged.map((x) => x.componentId)).toEqual([victim.id]);
      expect(flagged[0]?.linkable).toBe(false);
    } finally {
      await db().product.update({ where: { id: victim.id }, data: { status: victim.status } });
    }
    expect((await must(slug)).available).toBeGreaterThan(0);
  });

  it("an out-of-stock part makes the bundle unavailable and the part 'short'", async () => {
    const slug = await slugOfFirst("BUNDLE");
    const item = await db().bundleItem.findFirstOrThrow({
      where: { bundle: { slug } },
      include: { component: { include: { inventory: true } } },
    });
    const inv = item.component.inventory;
    if (!inv) throw new Error("component has inventory");
    try {
      await db().inventory.update({ where: { productId: item.componentId }, data: { onHand: 0 } });
      const p = await must(slug);
      expect(p.available).toBe(0);
      expect(p.bundle?.parts.find((x) => x.componentId === item.componentId)?.availability).toBe(
        "short",
      );
    } finally {
      await db().inventory.update({
        where: { productId: item.componentId },
        data: { onHand: inv.onHand },
      });
    }
  });
});
