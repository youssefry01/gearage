import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RECENT_MAX } from "@/domain/recently-viewed";
import { clearCategoryCaches } from "@/server/services/category.service";
import { getCardsBySlugs } from "@/server/services/cards.service";
import { getComparison } from "@/server/services/compare.service";
import { LocalStorageProvider } from "@/server/storage/local";
import { runSeed } from "../../prisma/seed/run";
import { db, resetData } from "./helpers";

let gpus: string[] = [];
let cpus: string[] = [];
let bundles: string[] = [];

async function slugsIn(
  prefix: string,
  type: "PHYSICAL" | "BUNDLE" = "PHYSICAL",
): Promise<string[]> {
  const rows = await db().product.findMany({
    where: {
      type,
      status: "ACTIVE",
      deletedAt: null,
      category: { OR: [{ path: prefix }, { path: { startsWith: `${prefix}/` } }] },
    },
    orderBy: { slug: "asc" },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}

beforeAll(async () => {
  await resetData();
  const dir = await mkdtemp(join(tmpdir(), "compare-test-"));
  await runSeed({ storage: new LocalStorageProvider(dir, "/uploads", { allowSvg: true }) });
  clearCategoryCaches();
  gpus = await slugsIn("components/graphics-cards");
  cpus = await slugsIn("components/cpus");
  bundles = (
    await db().product.findMany({
      where: { type: "BUNDLE", status: "ACTIVE", deletedAt: null },
      orderBy: { slug: "asc" },
      select: { slug: true },
    })
  ).map((b) => b.slug);
});

afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await db().$disconnect();
});

describe("comparing parts of one category", () => {
  it("has enough seeded products to test with", () => {
    expect(gpus.length).toBeGreaterThanOrEqual(4);
    expect(cpus.length).toBeGreaterThanOrEqual(2);
    expect(bundles.length).toBeGreaterThanOrEqual(2);
  });

  it("returns the products in the requested order, with one cell per product in every row", async () => {
    const asked = [gpus[2], gpus[0], gpus[1]] as string[];
    const view = await getComparison(asked);
    expect(view.kind).toBe("parts");
    expect(view.columns.map((c) => c.slug)).toEqual(asked);
    expect(view.missing).toEqual([]);
    expect(view.dropped).toBe(0);
    expect(view.categoryName).not.toBeNull();
    const ids = view.sections.map((s) => s.id);
    expect(ids).toContain("overview");
    expect(ids).toContain("specs");
    for (const row of view.sections.flatMap((s) => s.rows))
      expect(row.cells, row.id).toHaveLength(asked.length);
  });

  it("shows the same prices the listing views compute", async () => {
    const asked = gpus.slice(0, 3);
    const view = await getComparison(asked);
    const price = view.sections.flatMap((s) => s.rows).find((r) => r.id === "price");
    const expected = await db().$queryRaw<{ slug: string; price: number }[]>`
      SELECT p."slug", pr."effectivePrice"::int AS price
      FROM "product" p JOIN "product_pricing" pr ON pr."productId" = p."id"
      WHERE p."slug" = ANY(${asked}::text[])`;
    const bySlug = new Map(expected.map((e) => [e.slug, e.price]));
    expect(price?.cells).toEqual(asked.map((s) => ({ kind: "money", amount: bySlug.get(s) })));
  });

  it("uses a bounded number of statements (no query per product)", async () => {
    const spy = vi.spyOn(db(), "$queryRaw");
    await getComparison(gpus.slice(0, 4));
    expect(spy.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("compares graphics cards across brand sub-categories (NVIDIA with AMD with Intel)", async () => {
    const picked = await Promise.all(
      ["nvidia-geforce", "amd-radeon", "intel-arc"].map(async (leaf) => {
        const row = await db().product.findFirstOrThrow({
          where: {
            type: "PHYSICAL",
            status: "ACTIVE",
            deletedAt: null,
            category: { path: `components/graphics-cards/${leaf}` },
          },
          orderBy: { slug: "asc" },
          select: { slug: true },
        });
        return row.slug;
      }),
    );
    const view = await getComparison(picked);
    expect(view.columns.map((c) => c.slug)).toEqual(picked);
    expect(view.dropped).toBe(0);
    expect(view.sections.some((s) => s.id === "specs")).toBe(true);
    // The heading names the family, not the brand sub-category.
    expect(view.categoryName?.en).toBe("Graphics Cards");
  });

  it("every card carries the same compare group across a spec family, and a different one across families", async () => {
    const [a, b, cpu] = [
      "components/graphics-cards/nvidia-geforce",
      "components/graphics-cards/amd-radeon",
      "components/cpus/amd-ryzen",
    ];
    const first = async (path: string) =>
      (
        await db().product.findFirstOrThrow({
          where: { type: "PHYSICAL", status: "ACTIVE", deletedAt: null, category: { path } },
          select: { slug: true },
        })
      ).slug;
    const cards = await getCardsBySlugs([await first(a), await first(b), await first(cpu)]);
    expect(cards[0]?.compareGroup).toBe("cat:components/graphics-cards");
    expect(cards[1]?.compareGroup).toBe(cards[0]?.compareGroup);
    expect(cards[2]?.compareGroup).toBe("cat:components/cpus");
    const bundle = await getCardsBySlugs([bundles[0] as string]);
    expect(bundle[0]?.compareGroup).toBe("bundle");
  });

  it("keeps only the first product's category and reports the rest as dropped", async () => {
    const view = await getComparison([gpus[0] as string, cpus[0] as string, gpus[1] as string]);
    expect(view.columns.map((c) => c.slug)).toEqual([gpus[0], gpus[1]]);
    expect(view.dropped).toBe(1);
  });

  it("does not compare a bundle with a part", async () => {
    const view = await getComparison([bundles[0] as string, gpus[0] as string]);
    expect(view.kind).toBe("bundles");
    expect(view.columns).toHaveLength(1);
    expect(view.dropped).toBe(1);
  });

  it("caps at four and says so; duplicates and bad slugs are ignored", async () => {
    const view = await getComparison([
      ...gpus.slice(0, 5),
      gpus[0] as string,
      "Not A Slug",
      "../x",
    ]);
    expect(view.columns).toHaveLength(4);
    expect(view.truncated).toBe(true);
    const dup = await getComparison([gpus[0] as string, gpus[0] as string, "BAD SLUG"]);
    expect(dup.columns).toHaveLength(1);
    expect(dup.truncated).toBe(false);
  });

  it("reports unknown slugs as missing and still compares the rest", async () => {
    const view = await getComparison([gpus[0] as string, "no-such-product", gpus[1] as string]);
    expect(view.missing).toEqual(["no-such-product"]);
    expect(view.columns.map((c) => c.slug)).toEqual([gpus[0], gpus[1]]);
  });

  it("never shows archived, soft-deleted or inactive-brand products", async () => {
    const [a, b, c] = gpus as [string, string, string];
    const rowB = await db().product.findFirstOrThrow({ where: { slug: b } });
    const rowC = await db().product.findFirstOrThrow({ where: { slug: c } });
    try {
      await db().product.updateMany({ where: { slug: a }, data: { status: "ARCHIVED" } });
      await db().product.updateMany({ where: { slug: b }, data: { deletedAt: new Date() } });
      const view = await getComparison([a, b, c]);
      expect(view.columns.map((x) => x.slug)).toEqual([c]);
      expect(view.missing.sort()).toEqual([a, b].sort());
      if (rowC.brandId) {
        await db().brand.update({ where: { id: rowC.brandId }, data: { isActive: false } });
        const hidden = await getComparison([c]);
        expect(hidden.columns).toEqual([]);
        expect(hidden.kind).toBe("empty");
        expect(hidden.missing).toEqual([c]);
      }
    } finally {
      await db().product.updateMany({ where: { slug: a }, data: { status: "ACTIVE" } });
      await db().product.updateMany({ where: { slug: b }, data: { deletedAt: rowB.deletedAt } });
      if (rowC.brandId)
        await db().brand.update({ where: { id: rowC.brandId }, data: { isActive: true } });
    }
  });

  it("an empty request is empty", async () => {
    expect((await getComparison([])).kind).toBe("empty");
  });
});

describe("comparing bundles", () => {
  it("lists each kind of part, a summary, and no single warranty", async () => {
    const asked = bundles.slice(0, 3);
    const view = await getComparison(asked);
    expect(view.kind).toBe("bundles");
    expect(view.columns.map((c) => c.slug)).toEqual(asked);
    const ids = view.sections.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["overview", "parts", "summary"]));
    expect(ids).not.toContain("specs");
    const rows = view.sections.flatMap((s) => s.rows);
    expect(rows.find((r) => r.id === "warranty")).toBeUndefined();
    for (const r of rows) expect(r.cells, r.id).toHaveLength(asked.length);
  });

  it("has one row per spec family: no brand sub-category rows", async () => {
    const view = await getComparison(bundles.slice(0, 4));
    const ids = (view.sections.find((s) => s.id === "parts")?.rows ?? []).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).not.toMatch(/nvidia|amd|intel|ryzen|geforce|radeon/);
    }
    expect(ids).toContain("parts:components/cpus");
    expect(ids).toContain("parts:components/graphics-cards");
  });

  it("shows every component of every bundle exactly once (quantities included)", async () => {
    const asked = bundles.slice(0, 4);
    const view = await getComparison(asked);
    const partRows = view.sections.find((s) => s.id === "parts")?.rows ?? [];
    for (const [i, slug] of asked.entries()) {
      const items = await db().bundleItem.findMany({
        where: { bundle: { slug } },
        select: { quantity: true },
      });
      const shown = partRows.flatMap((r) => {
        const cell = r.cells[i];
        return cell?.kind === "list" ? cell.items : [];
      });
      expect(shown, slug).toHaveLength(items.length);
    }
  });

  it("every seeded bundle reads as compatible (the verified-compatible builds)", async () => {
    const view = await getComparison(bundles.slice(0, 4));
    const compat = view.sections.flatMap((s) => s.rows).find((r) => r.id === "compat");
    expect(compat).toBeDefined();
    for (const cell of compat?.cells ?? []) {
      expect(cell.kind).toBe("compat");
      if (cell.kind === "compat") expect(cell.status).not.toBe("problem");
    }
  });

  it("uses a bounded number of statements for four bundles", async () => {
    const spy = vi.spyOn(db(), "$queryRaw");
    await getComparison(bundles.slice(0, 4));
    expect(spy.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe("cards for the recently viewed shelf", () => {
  it("returns cards in the requested order, without duplicates", async () => {
    const asked = [gpus[3], cpus[0], gpus[0]] as string[];
    const cards = await getCardsBySlugs([...asked, asked[0] as string]);
    expect(cards.map((c) => c.slug)).toEqual(asked);
    const first = cards[0];
    expect(first?.categoryPath.startsWith("components/graphics-cards")).toBe(true);
    expect(first?.effectivePrice).toBeGreaterThan(0);
  });

  it("leaves out hidden and unknown products and ignores bad slugs", async () => {
    const [a, b] = gpus as [string, string];
    try {
      await db().product.updateMany({ where: { slug: a }, data: { status: "DRAFT" } });
      const cards = await getCardsBySlugs([a, "no-such-product", "Bad Slug", b]);
      expect(cards.map((c) => c.slug)).toEqual([b]);
    } finally {
      await db().product.updateMany({ where: { slug: a }, data: { status: "ACTIVE" } });
    }
  });

  it("caps the list and uses a bounded number of statements", async () => {
    const many = [...gpus, ...cpus, ...bundles];
    const spy = vi.spyOn(db(), "$queryRaw");
    const cards = await getCardsBySlugs(many);
    expect(cards.length).toBeLessThanOrEqual(RECENT_MAX);
    expect(spy.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("nothing in, nothing out", async () => {
    expect(await getCardsBySlugs([])).toEqual([]);
  });
});
