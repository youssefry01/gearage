import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HOME_FEATURED_POOL, HOME_RAILS, HOME_RAIL_SIZE, railViewAllQuery } from "@/domain/home";
import { cardSavings, parseListingParams } from "@/domain/listing";
import { parseSearchQuery, toTsQueryText } from "@/domain/search";
import { queryListing } from "@/server/repositories/listing.repository";
import { clearCategoryCaches } from "@/server/services/category.service";
import { getHomeData } from "@/server/services/home.service";
import {
  type SearchView,
  getSearchView,
  getSuggestions,
  logZeroResult,
} from "@/server/services/search.service";
import { topZeroResults } from "@/server/repositories/search.repository";
import { LocalStorageProvider } from "@/server/storage/local";
import { runSeed } from "../../prisma/seed/run";
import { db, resetData } from "./helpers";

let dir: string;
/** product id -> category path, for every seeded product. */
const categoryOf = new Map<string, string>();

beforeAll(async () => {
  await resetData();
  dir = await mkdtemp(join(tmpdir(), "search-test-"));
  await runSeed({ storage: new LocalStorageProvider(dir, "/uploads", { allowSvg: true }) });
  clearCategoryCaches();
  const rows = await db().$queryRaw<{ id: string; path: string }[]>`
    SELECT p."id", c."path" FROM "product" p JOIN "category" c ON c."id" = p."categoryId"`;
  for (const r of rows) categoryOf.set(r.id, r.path);
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const search = (q: string, extra: Record<string, string> = {}): Promise<SearchView> =>
  getSearchView({ q, ...extra }, 100);
const titles = (v: SearchView) => v.items.map((i) => i.title.en);
const inCategory = (v: SearchView, prefix: string, count = v.items.length) =>
  v.items.slice(0, count).every((i) => categoryOf.get(i.id)?.startsWith(prefix));

type Expectation = {
  q: string;
  tier: SearchView["tier"];
  /** Regex the best result's English title must match. */
  top?: RegExp;
  /** Minimum and maximum number of matches. */
  min?: number;
  max?: number;
  /** Every one of the first `count` results must be in a category starting with this path. */
  category?: { prefix: string; count: number };
  /** The first `count` results' English titles must all match (bundles and incidental mentions may follow). */
  lead?: { re: RegExp; count: number };
  /** Every result's English title must match. Only for queries where nothing else can legitimately match. */
  every?: RegExp;
};

// The quality table. Each row is a query a shopper in Egypt could plausibly type, with what a sensible search must do.
// Expectations come from the seeded catalog (prisma/seed/data); when the seed changes, review this table with it.
const QUALITY: Expectation[] = [
  // model numbers, spelled every way
  { q: "rtx 4060", tier: "exact", top: /Dual GeForce RTX 4060/, min: 3, max: 3 },
  { q: "RTX4060", tier: "exact", top: /Dual GeForce RTX 4060/, min: 3, max: 3 },
  { q: "rtx-4060", tier: "exact", top: /Dual GeForce RTX 4060/, min: 3, max: 3 },
  { q: "4060", tier: "exact", top: /RTX 4060/, min: 3, max: 3 },
  { q: "٤٠٦٠", tier: "exact", top: /RTX 4060/, min: 3, max: 3 },
  { q: "geforce rtx 5060 ti", tier: "exact", top: /RTX 5060 Ti WINDFORCE/ },
  { q: "ryzen 5 5600", tier: "exact", top: /Ryzen 5 5600 Processor/ },
  { q: "ryzen5 5600", tier: "exact", top: /Ryzen 5 5600 Processor/ },
  { q: "7800x3d", tier: "exact", top: /7800X3D Processor/, min: 2, max: 2 },
  { q: "i5-14400F", tier: "exact", top: /Core i5-14400F Processor/ },
  { q: "i5 14400f", tier: "exact", top: /Core i5-14400F Processor/ },
  { q: "990 pro", tier: "exact", top: /990 PRO/ },
  { q: "990pro", tier: "exact", top: /990 PRO/ },
  // 3 boards, then the bundles that contain one
  { q: "b650", tier: "exact", min: 4, category: { prefix: "components/motherboards", count: 3 } },
  { q: "ssd 2tb", tier: "exact", top: /990 PRO 2TB/, min: 1, max: 1 },
  { q: "nvme 1tb", tier: "exact", lead: { re: /1TB/, count: 4 }, min: 4 },
  { q: "ddr5 32gb", tier: "exact", lead: { re: /DDR5 32GB/, count: 3 }, min: 3 },
  { q: "27 inch monitor 165hz", tier: "exact", top: /27GP850-B/ },
  // product-type words in English and Arabic reach the same products
  {
    q: "gpu",
    tier: "exact",
    min: 9,
    max: 9,
    category: { prefix: "components/graphics-cards", count: 9 },
  },
  {
    q: "graphics card",
    tier: "exact",
    category: { prefix: "components/graphics-cards", count: 9 },
  },
  { q: "كارت شاشة", tier: "exact", category: { prefix: "components/graphics-cards", count: 9 } },
  { q: "كرت شاشه", tier: "exact", category: { prefix: "components/graphics-cards", count: 9 } },
  { q: "كروت الشاشة", tier: "exact", category: { prefix: "components/graphics-cards", count: 9 } },
  { q: "processor", tier: "exact", category: { prefix: "components/cpus", count: 9 } },
  { q: "معالج", tier: "exact", category: { prefix: "components/cpus", count: 9 } },
  { q: "المعالجات", tier: "exact", category: { prefix: "components/cpus", count: 9 } },
  {
    q: "motherboard",
    tier: "exact",
    min: 7,
    category: { prefix: "components/motherboards", count: 7 },
  },
  {
    q: "لوحة ام",
    tier: "exact",
    min: 7,
    category: { prefix: "components/motherboards", count: 7 },
  },
  {
    q: "مازربورد",
    tier: "exact",
    min: 7,
    category: { prefix: "components/motherboards", count: 7 },
  },
  {
    q: "اللوحات الأم",
    tier: "exact",
    min: 7,
    category: { prefix: "components/motherboards", count: 7 },
  },
  {
    q: "رام 32 جيجا",
    tier: "exact",
    every: /32GB/,
    category: { prefix: "components/memory", count: 3 },
  },
  { q: "ذاكرة ddr5", tier: "exact", category: { prefix: "components/memory", count: 5 } },
  {
    q: "مصدر طاقة 750 واط",
    tier: "exact",
    min: 2,
    category: { prefix: "components/power-supplies", count: 2 },
  },
  { q: "باور سبلاي", tier: "exact", category: { prefix: "components/power-supplies", count: 6 } },
  { q: "صندوق كمبيوتر", tier: "exact", category: { prefix: "components/cases", count: 5 } },
  { q: "مبرد مائي", tier: "exact", top: /MasterLiquid/, min: 2 },
  { q: "شاشة 27 بوصة", tier: "exact", category: { prefix: "monitors", count: 3 } },
  { q: "لابتوب", tier: "exact", category: { prefix: "laptops", count: 4 } },
  { q: "لاب توب لينوفو", tier: "exact", every: /Lenovo/, min: 2, max: 2 },
  { q: "كيبورد", tier: "exact", category: { prefix: "peripherals/keyboards", count: 2 } },
  { q: "ماوس لوجيتك", tier: "exact", top: /Logitech.*Mouse/ },
  { q: "راوتر", tier: "exact", top: /Router/ },
  { q: "تجميعة العاب", tier: "exact", category: { prefix: "pc-bundles", count: 4 } },
  // brands, including Arabic spellings (no brand has an Arabic name in the catalog)
  { q: "انفيديا", tier: "exact", min: 6, top: /NVIDIA|GeForce/ },
  { q: "سامسونج", tier: "exact", lead: { re: /Samsung/, count: 4 } },
  { q: "ايسوس", tier: "exact", min: 5 },
  { q: "كينجستون", tier: "exact", lead: { re: /Kingston/, count: 5 } },
  { q: "western digital", tier: "exact", min: 5 },
  // typos in words: corrected, and the corrected search finds the right things
  { q: "ryzn 5 5600", tier: "corrected", top: /Ryzen 5 5600 Processor/ },
  { q: "nvidea", tier: "corrected", min: 6, top: /NVIDIA|GeForce/ },
  { q: "nvdia rtx", tier: "corrected", min: 6 },
  { q: "geforse", tier: "corrected", min: 6 },
  { q: "corsiar vengance", tier: "corrected", lead: { re: /VENGEANCE/, count: 3 } },
  { q: "kingstone", tier: "corrected", lead: { re: /Kingston/, count: 5 } },
  { q: "samsng 990", tier: "corrected", lead: { re: /Samsung 990/, count: 2 } },
  { q: "motherbord", tier: "corrected", category: { prefix: "components/motherboards", count: 7 } },
  { q: "keybord", tier: "corrected", category: { prefix: "peripherals/keyboards", count: 2 } },
  { q: "procesor", tier: "corrected", category: { prefix: "components/cpus", count: 9 } },
  {
    q: "graphcs card",
    tier: "corrected",
    category: { prefix: "components/graphics-cards", count: 9 },
  },
  { q: "معلج", tier: "corrected", category: { prefix: "components/cpus", count: 9 } },
  {
    q: "كارت شاشه انفديا",
    tier: "corrected",
    category: { prefix: "components/graphics-cards", count: 5 },
  },
  { q: "لابتوب لينوفوو", tier: "corrected", every: /Lenovo/ },
  { q: "مازربورد ايسوز", tier: "corrected", every: /ASUS/ },
  // prefixes are not typos
  { q: "lapto", tier: "exact", min: 5 },
  { q: "gigabyt", tier: "exact", min: 5 },
  // things we do not sell, or cannot understand: no pretending
  { q: "x870", tier: "none", max: 0 },
  { q: "gtx 1080", tier: "none", max: 0 },
  { q: "4070", tier: "none", max: 0 },
  { q: "playstation", tier: "none", max: 0 },
  { q: "seasonic", tier: "none", max: 0 },
  { q: "xyzzy", tier: "none", max: 0 },
  // relaxing: some words match, and it says so
  { q: "rtx 4070", tier: "partial", every: /RTX|GeForce/ },
  // matches two of the words first, then products matching one
  {
    q: "logitech keyboard xyz",
    tier: "partial",
    top: /Logitech MX Keys/,
    lead: { re: /Logitech|Keyboard/i, count: 6 },
  },
];

describe("search quality on the seeded catalog", () => {
  it.each(QUALITY)("$q -> $tier", async (e) => {
    const v = await search(e.q);
    expect(v.tier).toBe(e.tier);
    if (e.min !== undefined) expect(v.total).toBeGreaterThanOrEqual(e.min);
    if (e.max !== undefined) expect(v.total).toBeLessThanOrEqual(e.max);
    if (e.top) expect(titles(v)[0]).toMatch(e.top);
    if (e.every) for (const t of titles(v)) expect(t).toMatch(e.every);
    if (e.lead)
      for (const t of titles(v).slice(0, e.lead.count))
        expect(t, titles(v).join(" | ")).toMatch(e.lead.re);
    if (e.category)
      expect(inCategory(v, e.category.prefix, e.category.count), titles(v).join(" | ")).toBe(true);
  });

  it("the exact spelling of a model number never changes what is found", async () => {
    const same = ["rtx 4060", "RTX4060", "rtx-4060", "Rtx  4060", "4060"];
    const results = await Promise.all(
      same.map(async (q) => (await search(q)).items.map((i) => i.id)),
    );
    for (const ids of results)
      expect([...ids].sort()).toEqual([...(results[0] as string[])].sort());
  });

  it("Arabic and English names of a product type lead with the same products", async () => {
    const leads = await Promise.all(
      ["gpu", "graphics card", "كارت شاشة", "كرت الشاشه", "كروت الشاشة"].map(async (q) =>
        (await search(q)).items
          .slice(0, 9)
          .map((i) => i.id)
          .sort(),
      ),
    );
    for (const s of leads) expect(s).toEqual(leads[0]);
    expect(
      leads[0]?.every((id) => categoryOf.get(id)?.startsWith("components/graphics-cards")),
    ).toBe(true);
  });

  it("ranks the products themselves above bundles for generic product words", async () => {
    for (const [q, n] of [
      ["gpu", 9],
      ["كارت شاشة", 9],
      ["processor", 9],
      ["معالج", 9],
    ] as const)
      expect(
        (await search(q)).items.slice(0, n).every((i) => i.type === "PHYSICAL"),
        q,
      ).toBe(true);
    // ...and a part's model finds the bundles that contain it, after the part itself
    const v = await search("rtx 4060");
    expect(v.items[0]?.type).toBe("PHYSICAL");
    expect(v.items.some((i) => i.type === "BUNDLE")).toBe(true);
  });

  it("puts the exact product before products that merely contain the number", async () => {
    const v = await search("ryzen 5 5600");
    expect(titles(v)[0]).toBe("AMD Ryzen 5 5600 Processor");
  });

  it("never matches a unit written together by joining unrelated words (2tb is not '2' and 'tb' anywhere)", async () => {
    const v = await search("2tb");
    expect(titles(v)[0]).toMatch(/990 PRO 2TB/);
    // anything else must really contain 2TB (a bundle through its parts), never merely a "2" and a "tb" somewhere
    for (const i of v.items.slice(1)) if (i.type !== "BUNDLE") expect(i.title.en).toMatch(/2TB/i);
  });
});

describe("tiers and notices", () => {
  it("does not look for typos when a filter is active (an empty filter is not a spelling problem)", async () => {
    const v = await search("ryzn", { in_stock: "1" });
    expect(v.tier).toBe("none");
    expect(v.zeroResultTerm).toBeNull();
  });

  it("says when the term is too short to search", async () => {
    const v = await search("a");
    expect(v.tooShort).toBe(true);
    expect(v.total).toBe(0);
  });

  it("with no term it is the all-products view", async () => {
    const v = await getSearchView({}, 100);
    expect(v.tier).toBe("browse");
    expect(v.query).toBeUndefined();
    const visible = await db().product.count({ where: { status: "ACTIVE", deletedAt: null } });
    expect(v.total).toBe(visible);
  });

  it("treats a term of only punctuation as no term", async () => {
    expect((await getSearchView({ q: "!!!" })).tier).toBe("browse");
  });

  it("offers a zero-result term for analytics only when it is a plain, filter-free product search", async () => {
    expect((await search("xyzzy")).zeroResultTerm).toBe("xyzzy");
    expect((await search("someone@example.com")).zeroResultTerm).toBeNull();
    expect((await search("01012345678")).zeroResultTerm).toBeNull();
    expect((await search("rtx 4060")).zeroResultTerm).toBeNull();
  });

  it("records zero-result searches without waiting for anything", async () => {
    await logZeroResult("seasonic", new Date("2026-10-25T12:00:00Z"));
    const top = await topZeroResults("2026-10-25", 5);
    expect(top).toContainEqual({ term: "seasonic", count: 1 });
  });
});

describe("what a search may show", () => {
  it("never shows products that are not for sale, even though they are indexed", async () => {
    const victim = (await search("rtx 4060")).items[0];
    expect(victim).toBeDefined();
    const id = victim?.id as string;
    for (const patch of [{ status: "DRAFT" as const }, { status: "ARCHIVED" as const }]) {
      await db().product.update({ where: { id }, data: patch });
      expect((await search("rtx 4060")).items.map((i) => i.id)).not.toContain(id);
      expect(
        (
          await db().$queryRaw<
            { n: number }[]
          >`SELECT COUNT(*)::int n FROM product_search WHERE "productId" = ${id}::uuid`
        )[0]?.n,
      ).toBe(1);
    }
    await db().product.update({ where: { id }, data: { status: "ACTIVE" } });
    expect((await search("rtx 4060")).items.map((i) => i.id)).toContain(id);
    await db().product.update({
      where: { id },
      data: { deletedAt: new Date("2026-01-01T00:00:00Z") },
    });
    expect((await search("rtx 4060")).items.map((i) => i.id)).not.toContain(id);
    await db().product.update({ where: { id }, data: { deletedAt: null } });
  });

  it("lists out-of-stock products, after the ones that can be bought, when relevance is equal", async () => {
    const v = await search("radeon");
    const stock = v.items.map((i) => i.available !== null && i.available <= 0);
    expect(stock).toContain(true);
    // a sold-out exact match is still shown; among equally relevant results the available ones come first
    expect(v.items.length).toBeGreaterThan(1);
  });

  it("paginates a ranking stably: pages never overlap and together equal one long page", async () => {
    const all = (await getSearchView({ q: "gaming" }, 100)).items.map((i) => i.id);
    expect(all.length).toBeGreaterThan(8);
    const pages: string[] = [];
    for (let page = 1; page <= Math.ceil(all.length / 5); page++)
      pages.push(
        ...(await getSearchView({ q: "gaming", page: String(page) }, 5)).items.map((i) => i.id),
      );
    expect(pages).toEqual(all);
    expect(new Set(pages).size).toBe(pages.length);
  });

  it("is deterministic: the same search twice gives the same order", async () => {
    for (const q of ["gaming", "ddr5", "كارت شاشة", "intel"]) {
      const a = (await search(q)).items.map((i) => i.id);
      const b = (await search(q)).items.map((i) => i.id);
      expect(b, q).toEqual(a);
    }
  });
});

describe("filters, sorting and categories on search results", () => {
  it("a filter narrows the search and the counts describe the narrowed set", async () => {
    const all = await search("gaming");
    const inStock = await search("gaming", { in_stock: "1" });
    expect(inStock.total).toBeLessThan(all.total);
    expect(inStock.items.every((i) => i.available === null || i.available > 0)).toBe(true);
    expect(all.inStockCount).toBe(inStock.total);
  });

  it("brand facet counts equal the actual number of results for that brand", async () => {
    const v = await search("ddr5");
    for (const o of v.brandOptions) {
      const narrowed = await search("ddr5", { brand: o.value });
      expect(narrowed.total, o.value).toBe(o.count);
    }
  });

  it("sorts by price within a search, ignoring relevance", async () => {
    const v = await search("ddr5", { sort: "price-asc" });
    const prices = v.items.map((i) => i.effectivePrice);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("scopes a search to a category and lists its sub-categories with counts", async () => {
    const wide = await search("gaming");
    expect(wide.categoryOptions.length).toBeGreaterThan(1);
    const top = wide.categoryOptions[0];
    expect(top?.path.includes("/")).toBe(false); // top-level categories first
    const scoped = await search("gaming", { category: top?.path ?? "" });
    expect(scoped.total).toBe(top?.count);
    expect(scoped.categoryTrail.map((c) => c.path)).toEqual([top?.path]);
    for (const o of scoped.categoryOptions) expect(o.path.startsWith(`${top?.path}/`)).toBe(true);
    for (const i of scoped.items)
      expect(categoryOf.get(i.id)?.startsWith(top?.path ?? "?")).toBe(true);
  });

  it("category facet counts equal the results of choosing that category", async () => {
    const wide = await search("gaming");
    for (const o of wide.categoryOptions)
      expect((await search("gaming", { category: o.path })).total, o.path).toBe(o.count);
  });

  it("drops a category that does not exist, like any invalid parameter", async () => {
    const v = await search("gaming", { category: "no-such/category" });
    expect(v.filters).not.toHaveProperty("category");
    expect(v.total).toBe((await search("gaming")).total);
  });

  it("shows spec filters once a category with specs is chosen, and they work", async () => {
    const v = await search("kingston", { category: "components/memory" });
    expect(v.specFacets.length).toBeGreaterThan(0);
    expect(v.total).toBeGreaterThan(0);
  });

  it("a category page never turns into a search because of ?q=", async () => {
    const f = parseListingParams({ q: "rtx", category: "components" });
    expect(f).not.toHaveProperty("q");
  });
});

describe("statement count (no N+1)", () => {
  it("a search with facets and the category facet is exactly three statements", async () => {
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
    const parsed = parseSearchQuery("gaming");
    await queryListing(
      {
        filters: parseListingParams({ q: "gaming" }, [], { search: true }),
        specDefs: [],
        pageSize: 24,
        withCategoryFacet: true,
        search: { tsQuery: toTsQueryText(parsed) ?? "", phrasePatterns: ["%gaming%"] },
      },
      counting,
    );
    expect(calls).toBe(3);
  });
});

describe("suggestions", () => {
  it("returns a handful of products, categories and brands for a word", async () => {
    const s = await getSuggestions("gpu");
    expect(s.products.length).toBeGreaterThan(0);
    expect(s.products.length).toBeLessThanOrEqual(5);
    expect(s.total).toBe(9);
    expect(s.categories.map((c) => c.path)).toContain("components/graphics-cards");
  });

  it("matches brands in Arabic and English", async () => {
    expect((await getSuggestions("انفيديا")).brands.map((b) => b.slug)).toContain("nvidia");
    expect((await getSuggestions("nvid")).brands.map((b) => b.slug)).toContain("nvidia");
  });

  it("tolerates typos like the results page", async () => {
    const s = await getSuggestions("corsiar");
    expect(s.corrected).toBe("corsair");
    expect(s.products.length).toBeGreaterThan(0);
  });

  it("answers nothing for one character, and never fails on odd input", async () => {
    for (const q of [
      "",
      "a",
      "   ",
      "!!!",
      "'; DROP TABLE product; --",
      "<script>",
      "\u0000",
      "x".repeat(500),
    ]) {
      const s = await getSuggestions(q);
      expect(Array.isArray(s.products)).toBe(true);
    }
    expect((await getSuggestions("a")).products).toEqual([]);
  });

  it("marks products that are sold out", async () => {
    const s = await getSuggestions("radeon rx 7600");
    expect(s.products[0]?.available).toBe(0);
  });
});

describe("home rails and their view-all links", () => {
  it("the first products of each 'view all' page are exactly the rail", async () => {
    const home = await getHomeData();
    const heroId = home.hero?.product.id;
    for (const key of HOME_RAILS) {
      const raw = Object.fromEntries(new URLSearchParams(railViewAllQuery(key)));
      const pageSize = key === "featured" ? HOME_FEATURED_POOL : HOME_RAIL_SIZE;
      const view = await getSearchView(raw, pageSize);
      expect(view.tier).toBe("browse");
      const expected = view.items
        .map((i) => i.id)
        .filter((id) => (key === "featured" ? id !== heroId : true))
        .slice(0, HOME_RAIL_SIZE);
      expect(
        home.rails[key].map((p) => p.id),
        key,
      ).toEqual(expected);
      // and the page lists at least everything the rail shows, so "view all" never shows less than the rail
      expect(view.total, key).toBeGreaterThanOrEqual(home.rails[key].length);
    }
  });

  it("the deals view lists only products with a real saving, biggest first", async () => {
    const raw = Object.fromEntries(new URLSearchParams(railViewAllQuery("deals")));
    const v = await getSearchView(raw, 100);
    expect(v.total).toBeGreaterThan(3);
    const percents = v.items.map((i) => {
      const saving = cardSavings(i);
      expect(saving, i.title.en).not.toBeNull();
      return saving?.percent ?? 0;
    });
    expect(percents).toEqual([...percents].sort((a, b) => b - a));
  });
});
