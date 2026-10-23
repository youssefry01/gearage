import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { buildCategoryTree, findCategory } from "@/domain/category-tree";
import {
  type ListingFilters,
  type SpecSelection,
  cardSavings,
  listingFacets,
  parseListingParams,
  specsMatch,
} from "@/domain/listing";
import type { SpecDef } from "@/domain/specs";
import {
  fetchActiveCategories,
  fetchSpecDefinitionsByPath,
} from "@/server/repositories/category.repository";
import { type ListingRow, queryListing } from "@/server/repositories/listing.repository";
import { clearCategoryCaches, getSpecDefinitions } from "@/server/services/category.service";
import { getListing } from "@/server/services/listing.service";
import { LocalStorageProvider } from "@/server/storage/local";
import { runSeed } from "../../prisma/seed/run";
import { db, resetData } from "./helpers";

let dir: string;

type RefProduct = {
  row: ListingRow;
  brand: string | null;
  tags: string[];
  specs: Record<string, unknown>;
};
let reference: RefProduct[] = [];

const noFilters = (over: Partial<ListingFilters> = {}): ListingFilters => ({
  brands: [],
  tags: [],
  inStock: false,
  onSale: false,
  specs: {},
  sort: "popular",
  page: 1,
  ...over,
});

/** A plain-TypeScript implementation of the filters, independent of the SQL. */
function reference_(path: string | undefined, f: ListingFilters): RefProduct[] {
  return reference.filter(({ row, brand, tags, specs }) => {
    if (path && row.categoryPath !== path && !row.categoryPath.startsWith(`${path}/`)) return false;
    if (f.brands.length && !(brand && f.brands.includes(brand))) return false;
    if (f.tags.length && !f.tags.some((t) => tags.includes(t))) return false;
    if (f.priceMin !== undefined && row.effectivePrice < f.priceMin) return false;
    if (f.priceMax !== undefined && row.effectivePrice > f.priceMax) return false;
    if (f.inStock && !(row.available === null || row.available > 0)) return false;
    if (f.onSale && cardSavings(row) === null) return false;
    return specsMatch(specs, f.specs);
  });
}

beforeAll(async () => {
  await resetData();
  dir = await mkdtemp(join(tmpdir(), "listing-test-"));
  await runSeed({ storage: new LocalStorageProvider(dir, "/uploads", { allowSvg: true }) });
  clearCategoryCaches();

  const all = await queryListing({
    filters: noFilters(),
    specDefs: [],
    pageSize: 500,
    withFacets: false,
  });
  const meta = await db().product.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: {
      id: true,
      specs: true,
      brand: { select: { slug: true } },
      tags: { select: { tag: { select: { slug: true } } } },
    },
  });
  const byId = new Map(meta.map((m) => [m.id, m]));
  reference = all.rows.map((row) => {
    const m = byId.get(row.id);
    return {
      row,
      brand: m?.brand?.slug ?? null,
      tags: m?.tags.map((t) => t.tag.slug) ?? [],
      specs: (m?.specs ?? {}) as Record<string, unknown>,
    };
  });
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const idsOf = (rows: readonly { id?: string; row?: ListingRow }[]) =>
  rows.map((r) => r.id ?? r.row?.id).sort();

describe("listing: statement count (no N+1)", () => {
  it("one request is exactly three statements, however many facets the category has", async () => {
    for (const path of ["components/cpus", "components", "pc-bundles", undefined]) {
      let calls = 0;
      const real = db();
      const counting = new Proxy(real, {
        get(target, prop, receiver) {
          if (prop === "$queryRaw")
            return (...args: unknown[]) => {
              calls++;
              return (target.$queryRaw as (...a: unknown[]) => unknown)(...args);
            };
          return Reflect.get(target, prop, receiver);
        },
      }) as typeof real;
      const specDefs = path ? await getSpecDefinitions(path) : [];
      await queryListing(
        { ...(path ? { categoryPath: path } : {}), filters: noFilters(), specDefs, pageSize: 24 },
        counting,
      );
      expect(calls, String(path)).toBe(3);
    }
  });
});

describe("listing: seeded catalog", () => {
  it("every seeded active product appears in the whole-catalog listing", async () => {
    const meta = await db().product.count({ where: { status: "ACTIVE", deletedAt: null } });
    const view = await getListing(undefined, {}, 500);
    expect(view.total).toBe(meta);
    expect(view.items).toHaveLength(meta);
  });

  it("a parent category lists its descendants; a leaf lists only its own", async () => {
    const cpus = await getListing("components/cpus", {}, 500);
    const ryzen = await getListing("components/cpus/amd-ryzen", {}, 500);
    const intel = await getListing("components/cpus/intel-core", {}, 500);
    expect(ryzen.total).toBeGreaterThan(0);
    expect(cpus.total).toBe(
      reference.filter((p) => p.row.categoryPath.startsWith("components/cpus")).length,
    );
    expect(cpus.total).toBeGreaterThanOrEqual(ryzen.total + intel.total);
  });

  it("cards carry image, brand and savings inputs", async () => {
    const view = await getListing("components", {}, 500);
    expect(view.items.every((i) => i.image !== null)).toBe(true);
    expect(view.items.some((i) => i.compareAtPrice !== null)).toBe(true);
    const bundles = await getListing("pc-bundles", {}, 50);
    expect(bundles.items.length).toBeGreaterThan(0);
    for (const b of bundles.items) {
      expect(b.type).toBe("BUNDLE");
      expect(b.componentCount).toBeGreaterThan(0);
    }
  });

  it("excludes draft, archived and soft-deleted products", async () => {
    const victim = reference.find((p) => p.row.type === "PHYSICAL");
    if (!victim) throw new Error("no product");
    const before = (await getListing(undefined, {}, 500)).total;
    await db().product.update({ where: { id: victim.row.id }, data: { status: "DRAFT" } });
    expect((await getListing(undefined, {}, 500)).total).toBe(before - 1);
    await db().product.update({
      where: { id: victim.row.id },
      data: { status: "ACTIVE", deletedAt: new Date() },
    });
    expect((await getListing(undefined, {}, 500)).total).toBe(before - 1);
    await db().product.update({
      where: { id: victim.row.id },
      data: { status: "ACTIVE", deletedAt: null },
    });
    expect((await getListing(undefined, {}, 500)).total).toBe(before);
  });
});

describe("listing: filters match an independent TypeScript implementation", () => {
  it("brand, tag, price, in-stock and sale filters (alone and combined)", async () => {
    const brands = [...new Set(reference.map((p) => p.brand).filter((b): b is string => !!b))];
    const tags = [...new Set(reference.flatMap((p) => p.tags))];
    const prices = reference.map((p) => p.row.effectivePrice).sort((a, b) => a - b);
    const mid = prices[Math.floor(prices.length / 2)] ?? 0;
    const cases: Partial<ListingFilters>[] = [
      { brands: brands.slice(0, 1) },
      { brands: brands.slice(0, 3).sort() },
      { tags: tags.slice(0, 1) },
      { tags: tags.slice(0, 2).sort() },
      { priceMin: mid },
      { priceMax: mid },
      { priceMin: mid / 2, priceMax: mid * 2 },
      { inStock: true },
      { onSale: true },
      { inStock: true, onSale: true, priceMax: mid * 3 },
      { brands: brands.slice(0, 2).sort(), tags: tags.slice(0, 1), inStock: true },
    ];
    for (const over of cases) {
      const f = noFilters(over);
      const got = await queryListing({
        filters: f,
        specDefs: [],
        pageSize: 500,
        withFacets: false,
      });
      expect(idsOf(got.rows), JSON.stringify(over)).toEqual(idsOf(reference_(undefined, f)));
      expect(got.total).toBe(got.rows.length);
    }
  });

  it("every seeded spec facet: each option / range / toggle matches the reference", async () => {
    const byPath = await fetchSpecDefinitionsByPath();
    let checked = 0;
    const kinds = new Set<string>();
    for (const path of byPath.keys()) {
      const defs = [...(await getSpecDefinitions(path))];
      const unfiltered = noFilters();
      const base = await queryListing({
        categoryPath: path,
        filters: unfiltered,
        specDefs: defs,
        pageSize: 500,
      });
      for (const def of listingFacets(defs)) {
        const entry = base.facets.specs[def.key];
        const selections: SpecSelection[] = [];
        if (def.facet === "CHECKBOX" && entry && "counts" in entry) {
          const values = Object.keys(entry.counts).sort();
          for (const v of values.slice(0, 3)) selections.push({ values: [v] });
          if (values.length > 1) selections.push({ values: values.slice(0, 2) });
        } else if (def.facet === "RANGE" && entry && "min" in entry) {
          const mid = (entry.min + entry.max) / 2;
          selections.push({ min: mid }, { max: mid }, { min: entry.min, max: entry.max });
        } else if (def.facet === "TOGGLE") selections.push({ on: true });
        for (const selection of selections) {
          kinds.add(`${def.facet}/${def.type}`);
          const f = noFilters({ specs: { [def.key]: selection } });
          const got = await queryListing({
            categoryPath: path,
            filters: f,
            specDefs: defs,
            pageSize: 500,
            withFacets: false,
          });
          expect(idsOf(got.rows), `${path} ${def.key} ${JSON.stringify(selection)}`).toEqual(
            idsOf(reference_(path, f)),
          );
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(30);
    // The seed exercises every spec-filter code path (so the parity above covers them all).
    expect([...kinds]).toEqual(expect.arrayContaining(["CHECKBOX/ENUM", "RANGE/NUMBER"]));
  });

  it("unknown spec keys and invalid values never reach SQL", async () => {
    const defs = [...(await getSpecDefinitions("components/cpus"))];
    const f = parseListingParams(
      { "spec.nope": "x", "spec.socket": "'; DROP TABLE product; --", brand: "x' OR '1'='1" },
      defs,
    );
    const view = await queryListing({
      categoryPath: "components/cpus",
      filters: f,
      specDefs: defs,
      pageSize: 24,
    });
    expect(view.total).toBeGreaterThan(0);
    expect(await db().product.count()).toBeGreaterThan(0);
  });
});

describe("listing: list and toggle specs (synthetic specs, so the SQL paths are covered whatever the seed holds)", () => {
  it("STRING_LIST (?| on a JSON array) and TOGGLE (JSON true) match the reference and are counted", async () => {
    const path = "components/cpus";
    const cpus = reference.filter((p) => p.row.categoryPath.startsWith(path)).slice(0, 4);
    expect(cpus.length).toBe(4);
    const patch: Record<string, unknown>[] = [
      { tags_x: ["Bluetooth", "USB receiver"], rgb: true },
      { tags_x: ["Bluetooth"], rgb: false },
      { tags_x: ["Wired"], rgb: true },
      { tags_x: "not-an-array", rgb: "yes" },
    ];
    const defs: SpecDef[] = [
      {
        key: "tags_x",
        type: "STRING_LIST",
        labelEn: "x",
        labelAr: "x",
        required: false,
        filterable: true,
        facet: "CHECKBOX",
      },
      {
        key: "rgb",
        type: "BOOLEAN",
        labelEn: "rgb",
        labelAr: "rgb",
        required: false,
        filterable: true,
        facet: "TOGGLE",
      },
    ];
    const originals = await db().product.findMany({
      where: { id: { in: cpus.map((c) => c.row.id) } },
      select: { id: true, specs: true },
    });
    try {
      for (const [i, c] of cpus.entries())
        await db().product.update({
          where: { id: c.row.id },
          data: {
            specs: {
              ...((originals.find((o) => o.id === c.row.id)?.specs ?? {}) as object),
              ...patch[i],
            } as Prisma.InputJsonObject,
          },
        });
      const live = (id: string, i: number) => ({
        ...(reference.find((r) => r.row.id === id)?.specs ?? {}),
        ...patch[i],
      });
      const ref = cpus.map((c, i) => ({ id: c.row.id, specs: live(c.row.id, i) }));
      const run = (specs: Record<string, SpecSelection>) =>
        queryListing({
          categoryPath: path,
          filters: noFilters({ specs }),
          specDefs: defs,
          pageSize: 100,
        });
      const expectIds = (specs: Record<string, SpecSelection>) =>
        ref
          .filter((r) => specsMatch(r.specs, specs))
          .map((r) => r.id)
          .sort();

      const selections: Record<string, SpecSelection>[] = [
        { tags_x: { values: ["Bluetooth"] } },
        { tags_x: { values: ["Wired", "USB receiver"] } },
        { rgb: { on: true } },
        { tags_x: { values: ["Bluetooth"] }, rgb: { on: true } },
      ];
      for (const sel of selections) {
        const got = await run(sel);
        const touched = got.rows
          .map((r) => r.id)
          .filter((id) => cpus.some((c) => c.row.id === id))
          .sort();
        expect(touched, JSON.stringify(sel)).toEqual(expectIds(sel));
      }
      const all = await run({});
      expect(all.facets.specs.tags_x).toEqual({
        counts: { Bluetooth: 2, "USB receiver": 1, Wired: 1 },
      });
      expect(all.facets.specs.rgb).toEqual({ count: 2 });
    } finally {
      for (const o of originals)
        await db().product.update({
          where: { id: o.id },
          data: { specs: (o.specs ?? {}) as object },
        });
    }
  });
});

describe("listing: facet counts", () => {
  it("are disjunctive: a facet's own selection does not hide its siblings, other facets narrow", async () => {
    const path = "components/cpus";
    const defs = [...(await getSpecDefinitions(path))];
    const socket = defs.find((d) => d.key === "socket");
    expect(socket, "cpu socket spec").toBeDefined();
    const all = await queryListing({
      categoryPath: path,
      filters: noFilters(),
      specDefs: defs,
      pageSize: 100,
    });
    const socketCounts = (all.facets.specs.socket as { counts: Record<string, number> }).counts;
    const [pick] = Object.keys(socketCounts);
    if (!pick) throw new Error("no sockets");

    const picked = await queryListing({
      categoryPath: path,
      filters: noFilters({ specs: { socket: { values: [pick] } } }),
      specDefs: defs,
      pageSize: 100,
    });
    // Sibling options keep their full counts...
    expect((picked.facets.specs.socket as { counts: Record<string, number> }).counts).toEqual(
      socketCounts,
    );
    // ...while brand counts now describe only the picked socket.
    expect(Object.values(picked.facets.brands).reduce((a, b) => a + b, 0)).toBe(picked.total);
    expect(picked.total).toBe(socketCounts[pick]);
  });

  it("facet totals add up to the filtered set", async () => {
    const all = await queryListing({
      categoryPath: "components",
      filters: noFilters(),
      specDefs: [],
      pageSize: 500,
    });
    expect(Object.values(all.facets.brands).reduce((a, b) => a + b, 0)).toBe(all.total);
    expect(all.facets.price?.min).toBe(
      Math.min(...reference_("components", noFilters()).map((p) => p.row.effectivePrice)),
    );
    expect(all.facets.inStock).toBe(reference_("components", noFilters({ inStock: true })).length);
    expect(all.facets.onSale).toBe(reference_("components", noFilters({ onSale: true })).length);
  });
});

describe("listing: sorting and pagination", () => {
  it("pages are disjoint, stable and together cover the whole set, for every sort", async () => {
    for (const sort of [
      "popular",
      "best-selling",
      "newest",
      "price-asc",
      "price-desc",
      "discount",
    ] as const) {
      const seen: string[] = [];
      let total = 0;
      for (let page = 1; page <= 20; page++) {
        const r = await queryListing({
          categoryPath: "components",
          filters: noFilters({ sort, page }),
          specDefs: [],
          pageSize: 10,
          withFacets: false,
        });
        total = r.total;
        seen.push(...r.rows.map((x) => x.id));
        if (r.rows.length < 10) break;
      }
      expect(new Set(seen).size, sort).toBe(seen.length);
      expect(seen.length, sort).toBe(total);
    }
  });

  it("orders by price both ways and by discount percent", async () => {
    const run = (sort: ListingFilters["sort"]) =>
      queryListing({
        filters: noFilters({ sort }),
        specDefs: [],
        pageSize: 500,
        withFacets: false,
      });
    const asc = (await run("price-asc")).rows.map((r) => r.effectivePrice);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = (await run("price-desc")).rows.map((r) => r.effectivePrice);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    const pct = (await run("discount")).rows.map((r) => cardSavings(r)?.percent ?? 0);
    // Percent is rounded in TS and exact in SQL, so allow equal neighbours but never an increase beyond rounding.
    for (let i = 1; i < pct.length; i++)
      expect((pct[i] ?? 0) - (pct[i - 1] ?? 0)).toBeLessThanOrEqual(1);
    expect(pct[0]).toBeGreaterThan(0);
    expect(pct.at(-1)).toBe(0);
  });

  it("default sort puts out-of-stock products last", async () => {
    const rows = (
      await queryListing({ filters: noFilters(), specDefs: [], pageSize: 500, withFacets: false })
    ).rows;
    const firstOut = rows.findIndex((r) => r.available !== null && r.available <= 0);
    expect(firstOut).toBeGreaterThan(-1);
    expect(rows.slice(firstOut).every((r) => r.available !== null && r.available <= 0)).toBe(true);
  });
});

describe("category tree (DB-served menu)", () => {
  it("hides inactive categories (Gift Cards) and includes the M2b additions", async () => {
    const tree = buildCategoryTree(await fetchActiveCategories());
    const tops = tree.map((c) => c.slug);
    expect(tops).not.toContain("gift-cards");
    expect(tops).toEqual(
      expect.arrayContaining(["components", "pc-bundles", "audio-streaming", "accessories"]),
    );
    expect(findCategory(tree, ["components", "cpus", "amd-ryzen"])?.chain).toHaveLength(3);
  });

  it("product counts roll up, and a category emptied of products drops out of the tree", async () => {
    const tree = buildCategoryTree(await fetchActiveCategories());
    const cpus = findCategory(tree, ["components", "cpus"])?.node;
    expect(cpus?.productCount).toBe(
      reference.filter((p) => p.row.categoryPath.startsWith("components/cpus")).length,
    );
    const ryzen = reference.filter((p) => p.row.categoryPath === "components/cpus/amd-ryzen");
    await db().product.updateMany({
      where: { id: { in: ryzen.map((p) => p.row.id) } },
      data: { status: "DRAFT" },
    });
    try {
      const after = buildCategoryTree(await fetchActiveCategories());
      expect(findCategory(after, ["components", "cpus", "amd-ryzen"])).toBeUndefined();
      expect(findCategory(after, ["components", "cpus"])).toBeDefined();
    } finally {
      await db().product.updateMany({
        where: { id: { in: ryzen.map((p) => p.row.id) } },
        data: { status: "ACTIVE" },
      });
    }
  });
});

describe("spec definitions per category", () => {
  it("sub-categories inherit the nearest ancestor's filter config", async () => {
    const own = await getSpecDefinitions("components/cpus");
    const inherited = await getSpecDefinitions("components/cpus/amd-ryzen");
    expect(own.length).toBeGreaterThan(0);
    expect(inherited.map((d: SpecDef) => d.key)).toEqual(own.map((d: SpecDef) => d.key));
  });
});
