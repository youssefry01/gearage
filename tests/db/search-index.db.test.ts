import { beforeAll, describe, expect, it } from "vitest";
import { asciiKey, foldForIndex, normalizeSearchText } from "@/domain/search-normalize";
import { parseSearchQuery, toTsQueryText } from "@/domain/search";
import {
  ZERO_RESULT_DAILY_CAP,
  lookupVocabulary,
  pruneZeroResults,
  rebuildSearchIndex,
  recordZeroResult,
  topZeroResults,
} from "@/server/repositories/search.repository";
import { db, makeBrand, makeBundle, makeCategory, makeProduct, resetData } from "./helpers";

/** Product ids whose search document matches the query, the way the application builds the match. */
async function matching(q: string): Promise<string[]> {
  const text = toTsQueryText(parseSearchQuery(q));
  if (text === null) return [];
  const rows = await db().$queryRaw<{ id: string }[]>`
    SELECT "productId" AS id FROM "product_search" WHERE "vector" @@ to_tsquery('simple', ${text})`;
  return rows.map((r) => r.id);
}

async function setTitle(id: string, titleEn: string, titleAr = "عنوان") {
  await db().product.update({ where: { id }, data: { titleEn, titleAr } });
}

beforeAll(resetData);

describe("search SQL functions agree with their TypeScript twins", () => {
  const corpus = [
    "RTX-4060 Ti",
    "وRTX 4060",
    "الشاشة الألعاب",
    "كارتَ شاشـة ١٢٣",
    "i5-14600K DDR5-6000",
    "ال جي",
    "الترابوك",
    "  Wi-Fi 6  ",
    "أإآ ىة ؤئ",
    "اللوحات الأم",
    "۱۶ جيجا",
    "لاب\u200Cتوب",
    "16جيجا RTX4060وRyzen",
    "Ünïcode ß ñ café",
    "",
    "!!!",
    'LG 27" 165Hz IPS',
    "WD_BLACK SN850X 1TB",
    "Cooler Master NR200P Mini-ITX",
  ];

  // Deterministic pseudo-random strings over the alphabets that matter: Latin, digits, Arabic letters and
  // diacritics, Arabic-Indic digits, punctuation and spaces.
  function randomStrings(count: number): string[] {
    let seed = 20261024;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const alphabet = [
      ..."abcdefghijklmnopqrstuvwxyzABCXYZ0123456789",
      ..."ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىي",
      ..."\u064B\u064C\u064E\u0651\u0640",
      ..."٠١٢٣٤٥٦٧٨٩۰۱۲",
      ..."  --_.,/\"'()+&",
    ];
    return Array.from({ length: count }, () =>
      Array.from(
        { length: 1 + Math.floor(next() * 24) },
        () => alphabet[Math.floor(next() * alphabet.length)],
      ).join(""),
    );
  }

  it("search_normalize, search_fold and search_ascii_key match on a corpus and 600 random strings", async () => {
    for (const s of [...corpus, ...randomStrings(600)]) {
      const [row] = await db().$queryRaw<{ n: string; f: string; k: string }[]>`
        SELECT search_normalize(${s}) AS n, search_fold(${s}) AS f, search_ascii_key(${s}) AS k`;
      expect(row?.n, `normalize ${JSON.stringify(s)}`).toBe(normalizeSearchText(s));
      expect(row?.f, `fold ${JSON.stringify(s)}`).toBe(foldForIndex(s));
      expect(row?.k, `ascii key ${JSON.stringify(s)}`).toBe(asciiKey(s));
    }
  });

  it("returns NULL for NULL (STRICT), so a missing description cannot break a document", async () => {
    const [row] = await db().$queryRaw<{ n: string | null }[]>`SELECT search_normalize(NULL) AS n`;
    expect(row?.n).toBeNull();
  });
});

describe("the index follows the catalog (triggers)", () => {
  it("indexes a new product by title, brand, model, SKU, category and tags", async () => {
    const brand = await makeBrand("zephyr");
    await db().brand.update({
      where: { id: brand.id },
      data: { nameEn: "Zephyr", nameAr: "زيفير" },
    });
    const p = await makeProduct({ categoryPath: "components/gpus", sku: "ZPH-9000-X" });
    await db().product.update({
      where: { id: p.id },
      data: {
        brandId: brand.id,
        titleEn: "Quantum Fox 9000 Graphics Card",
        titleAr: "كارت شاشة كوانتم",
        modelName: "Fox9000Ultra",
        shortDescriptionEn: "Whisper quiet cooling",
        shortDescriptionAr: "تبريد هادئ",
        specs: { memory_type: "GDDR7", ports: ["HDMI", "DisplayPort"], vram_gb: 16 },
      },
    });
    for (const q of [
      "quantum fox",
      "quantum fox 9000",
      "fox9000ultra",
      "fox 9000 ultra",
      "zephyr",
      "زيفير",
      "zph 9000",
      "كوانتم",
      "whisper",
      "gddr7",
      "displayport",
    ])
      expect(await matching(q), q).toContain(p.id);
    // numbers in specs are not text: they never produce a match
    expect(await matching("vram")).not.toContain(p.id);
  });

  it("a title change replaces the old words with the new ones", async () => {
    const p = await makeProduct();
    await setTitle(p.id, "Oldname Gadget");
    expect(await matching("oldname")).toContain(p.id);
    await setTitle(p.id, "Freshname Gadget");
    expect(await matching("oldname")).not.toContain(p.id);
    expect(await matching("freshname")).toContain(p.id);
  });

  it("a brand rename updates every product of the brand", async () => {
    const brand = await makeBrand("renamebrand");
    const a = await makeProduct();
    const b = await makeProduct();
    await db().product.updateMany({
      where: { id: { in: [a.id, b.id] } },
      data: { brandId: brand.id },
    });
    await db().brand.update({ where: { id: brand.id }, data: { nameEn: "Brandnewname" } });
    expect(await matching("brandnewname")).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(await matching("renamebrand")).not.toContain(a.id);
  });

  it("a category rename reaches products in the category and below it", async () => {
    const leaf = await makeCategory("peripherals-x/gadgets-x/widgets-x");
    const p = await makeProduct({ categoryPath: "peripherals-x/gadgets-x/widgets-x" });
    await db().category.update({
      where: { path: "peripherals-x" },
      data: { nameEn: "Zorblax Peripherals" },
    });
    expect(leaf.path).toBe("peripherals-x/gadgets-x/widgets-x");
    expect(await matching("zorblax")).toContain(p.id);
  });

  it("moving a product to another category changes what finds it", async () => {
    const p = await makeProduct({ categoryPath: "storage-m/drives-m" });
    await db().category.update({ where: { path: "storage-m" }, data: { nameEn: "Hoardstuff" } });
    expect(await matching("hoardstuff")).toContain(p.id);
    const other = await makeCategory("cooling-m/fans-m");
    await db().product.update({ where: { id: p.id }, data: { categoryId: other.id } });
    expect(await matching("hoardstuff")).not.toContain(p.id);
  });

  it("tags: adding, renaming and removing a tag follows through", async () => {
    const p = await makeProduct();
    const tag = await db().tag.create({
      data: { slug: "tag-q", nameEn: "Editorspick", nameAr: "اختيار" },
    });
    await db().productTag.create({ data: { productId: p.id, tagId: tag.id } });
    expect(await matching("editorspick")).toContain(p.id);
    await db().tag.update({ where: { id: tag.id }, data: { nameEn: "Staffpick" } });
    expect(await matching("editorspick")).not.toContain(p.id);
    expect(await matching("staffpick")).toContain(p.id);
    await db().productTag.deleteMany({ where: { productId: p.id } });
    expect(await matching("staffpick")).not.toContain(p.id);
  });

  it("a bundle is found by its parts' brand and model, not by their generic words", async () => {
    const brand = await makeBrand("partbrand");
    const gpu = await makeProduct({ categoryPath: "components/gpus" });
    await db().product.update({
      where: { id: gpu.id },
      data: {
        brandId: brand.id,
        titleEn: "Partbrand Turbo 77 Graphics Card",
        titleAr: "كارت شاشة تيربو",
        modelName: "Turbo77",
      },
    });
    const bundle = await makeBundle({ components: [{ product: gpu, quantity: 1 }] });
    expect(await matching("turbo77")).toContain(bundle.id);
    expect(await matching("partbrand")).toContain(bundle.id);
    // "graphics card" is in the part's title but must not make the bundle a graphics-card result
    expect(await matching("كارت شاشة")).not.toContain(bundle.id);
    // renaming the part's model reaches the bundle
    await db().product.update({ where: { id: gpu.id }, data: { modelName: "Turbo88" } });
    expect(await matching("turbo88")).toContain(bundle.id);
    expect(await matching("turbo77")).not.toContain(bundle.id);
    // removing the part from the bundle removes it from the bundle's document
    await db().bundleItem.deleteMany({ where: { bundleId: bundle.id } });
    expect(await matching("turbo88")).not.toContain(bundle.id);
  });

  it("soft-deleting removes the document, restoring brings it back, deleting cascades", async () => {
    const p = await makeProduct();
    await setTitle(p.id, "Phoenixware Special");
    expect(await matching("phoenixware")).toContain(p.id);
    await db().product.update({
      where: { id: p.id },
      data: { deletedAt: new Date("2026-01-01T00:00:00Z") },
    });
    expect(await matching("phoenixware")).not.toContain(p.id);
    await db().product.update({ where: { id: p.id }, data: { deletedAt: null } });
    expect(await matching("phoenixware")).toContain(p.id);
    await db().product.delete({ where: { id: p.id } });
    expect(await matching("phoenixware")).toEqual([]);
    expect(
      await db().$queryRaw<
        { n: number }[]
      >`SELECT COUNT(*)::int AS n FROM product_search WHERE "productId" = ${p.id}::uuid`,
    ).toEqual([{ n: 0 }]);
  });

  it("finds Arabic however the shopper spells the letters", async () => {
    const p = await makeProduct();
    await setTitle(p.id, "Some Case", "صندوق كمبيوتر ألعاب");
    for (const q of ["صندوق كمبيوتر", "الصندوق", "كمبيوتر", "العاب", "ألعاب", "صَنْدُوق"])
      expect(await matching(q), q).toContain(p.id);
  });

  it("never drifts: every document equals a fresh build, and there is one per non-deleted product", async () => {
    const drifted = await db().$queryRaw<{ id: string }[]>`
      SELECT p."id" FROM "product" p LEFT JOIN "product_search" ps ON ps."productId" = p."id"
      WHERE p."deletedAt" IS NULL AND (ps."productId" IS NULL OR ps."vector" IS DISTINCT FROM search_build_vector(p."id"))`;
    expect(drifted).toEqual([]);
    const [counts] = await db().$queryRaw<{ docs: number; products: number }[]>`
      SELECT (SELECT COUNT(*) FROM product_search)::int AS docs,
             (SELECT COUNT(*) FROM product WHERE "deletedAt" IS NULL)::int AS products`;
    expect(counts?.docs).toBe(counts?.products);
  });

  it("a full rebuild changes nothing (the nightly job is a safety net, not a different result)", async () => {
    const before = await db().$queryRaw<{ id: string; v: string }[]>`
      SELECT "productId" AS id, "vector"::text AS v FROM product_search ORDER BY 1`;
    await rebuildSearchIndex();
    const after = await db().$queryRaw<{ id: string; v: string }[]>`
      SELECT "productId" AS id, "vector"::text AS v FROM product_search ORDER BY 1`;
    expect(after).toEqual(before);
  });
});

describe("vocabulary and typo candidates", () => {
  it("collects letters-only words of three or more characters, never numbers or model codes", async () => {
    const words = (await db().$queryRaw<{ word: string }[]>`SELECT word FROM search_vocab`).map(
      (r) => r.word,
    );
    expect(words).toEqual(expect.arrayContaining(["quantum", "zephyr", "كوانتم"]));
    for (const w of words) expect(w).toMatch(/^([a-z]{3,40}|[\u0621-\u064A]{3,40})$/);
  });

  it("rebuild sets document frequencies and drops words no document contains", async () => {
    const p = await makeProduct();
    await setTitle(p.id, "Vanishingword Thing");
    expect(
      (
        await db().$queryRaw<
          { n: number }[]
        >`SELECT COUNT(*)::int n FROM search_vocab WHERE word='vanishingword'`
      )[0]?.n,
    ).toBe(1);
    await setTitle(p.id, "Other Thing");
    await setTitle((await makeProduct()).id, "Another Thing");
    // the trigger only adds words; the rebuild removes the stale one
    await rebuildSearchIndex();
    expect(
      (
        await db().$queryRaw<
          { n: number }[]
        >`SELECT COUNT(*)::int n FROM search_vocab WHERE word='vanishingword'`
      )[0]?.n,
    ).toBe(0);
    const [thing] = await db().$queryRaw<
      { freq: number }[]
    >`SELECT freq FROM search_vocab WHERE word='thing'`;
    expect(thing?.freq).toBe(2); // document frequency: two documents contain "thing"
  });

  it("proposes the right word for English and Arabic typos, and marks real prefixes as known", async () => {
    const p = await makeProduct();
    await setTitle(p.id, "Wombatron Bandicoot", "كارت شاشة ديناصور");
    const [en, ar, prefix, nonsense] = await lookupVocabulary([
      "wombatrno",
      "ديناسور",
      "wombat",
      "qqqqqqq",
    ]);
    expect(en?.candidates.map((c) => c.word)).toContain("wombatron");
    expect(ar?.candidates.map((c) => c.word)).toContain("ديناصور");
    expect(prefix?.known).toBe(true);
    expect(nonsense?.candidates).toEqual([]);
  });

  it("measures similarity on Arabic even when the database locale cannot (the ASCII key)", async () => {
    // With a plain "C" locale pg_trgm yields no trigrams for Arabic; the key makes it independent of the locale.
    const [row] = await db().$queryRaw<{ keyed: number; trigrams: number }[]>`
      SELECT similarity(search_ascii_key('كارت شاشه'), search_ascii_key('كرت شاشه'))::float AS keyed,
             COALESCE(array_length(show_trgm(search_ascii_key('شاشه')), 1), 0) AS trigrams`;
    expect(row?.keyed).toBeGreaterThan(0.5);
    expect(row?.trigrams).toBeGreaterThan(2);
  });

  it("has the GIN indexes the search relies on", async () => {
    const rows = await db().$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
        AND tablename IN ('product_search', 'search_vocab')`;
    const names = rows.map((r) => r.indexname);
    expect(names).toEqual(
      expect.arrayContaining(["product_search_vector_idx", "search_vocab_key_trgm_idx"]),
    );
  });
});

describe("zero-result analytics", () => {
  const day = (iso: string) => new Date(`${iso}T10:00:00.000Z`);

  it("counts a term once per day and keeps counting it", async () => {
    await recordZeroResult("seasonic psu", day("2026-10-20"));
    await recordZeroResult("seasonic psu", day("2026-10-20"));
    await recordZeroResult("seasonic psu", day("2026-10-21"));
    await recordZeroResult("other thing", day("2026-10-21"));
    const rows = await db().$queryRaw<{ day: string; n: number }[]>`
      SELECT "day"::text AS day, "count" AS n FROM search_zero_result WHERE term = 'seasonic psu' ORDER BY day`;
    expect(rows).toEqual([
      { day: "2026-10-20", n: 2 },
      { day: "2026-10-21", n: 1 },
    ]);
    expect(await topZeroResults("2026-10-20", 5)).toEqual([
      { term: "seasonic psu", count: 3 },
      { term: "other thing", count: 1 },
    ]);
  });

  it("stores no user, session or address (the table has no such column)", async () => {
    const cols = await db().$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'search_zero_result' ORDER BY 1`;
    expect(cols.map((c) => c.column_name)).toEqual(["count", "day", "lastAt", "term"]);
  });

  it("stops accepting new terms at the daily cap but keeps counting known ones", async () => {
    const d = day("2026-10-22");
    await db().$executeRaw`
      INSERT INTO search_zero_result ("day", "term", "count", "lastAt")
      SELECT '2026-10-22'::date, 'filler ' || g, 1, now() FROM generate_series(1, ${ZERO_RESULT_DAILY_CAP}) g`;
    await recordZeroResult("brand new term", d);
    expect(
      (
        await db().$queryRaw<
          { n: number }[]
        >`SELECT COUNT(*)::int n FROM search_zero_result WHERE term = 'brand new term'`
      )[0]?.n,
    ).toBe(0);
    await recordZeroResult("filler 7", d);
    expect(
      (
        await db().$queryRaw<
          { n: number }[]
        >`SELECT "count" n FROM search_zero_result WHERE term = 'filler 7' AND "day" = '2026-10-22'`
      )[0]?.n,
    ).toBe(2);
  });

  it("prunes rows older than a day", async () => {
    const removed = await pruneZeroResults("2026-10-22");
    expect(removed).toBeGreaterThanOrEqual(3);
    const left = await db().$queryRaw<
      { n: number }[]
    >`SELECT COUNT(*)::int n FROM search_zero_result WHERE "day" < '2026-10-22'`;
    expect(left[0]?.n).toBe(0);
  });

  it("rejects an empty or oversized term at the database", async () => {
    await expect(recordZeroResult("x", day("2026-10-25"))).rejects.toThrow();
    await expect(recordZeroResult("y".repeat(101), day("2026-10-25"))).rejects.toThrow();
  });
});

describe("daily maintenance jobs", () => {
  it("prunes zero-result rows past the retention period and keeps recent ones", async () => {
    const now = new Date("2026-12-01T00:00:00Z");
    await recordZeroResult("old term", new Date("2026-08-01T10:00:00Z"));
    await recordZeroResult("recent term", new Date("2026-11-20T10:00:00Z"));
    const { pruneOldZeroResults } = await import("@/server/services/search.service");
    await pruneOldZeroResults(now);
    const left = (
      await db().$queryRaw<
        { term: string }[]
      >`SELECT term FROM search_zero_result WHERE term IN ('old term','recent term')`
    ).map((r) => r.term);
    expect(left).toEqual(["recent term"]);
    // idempotent: a second run removes nothing more
    expect(await pruneOldZeroResults(now)).toBe(0);
  });

  it("the index rebuild repairs a document that a trigger-bypassing update left stale", async () => {
    const p = await makeProduct();
    await setTitle(p.id, "Intactword Thing");
    await db()
      .$executeRaw`UPDATE product_search SET vector = to_tsvector('simple', 'staleword') WHERE "productId" = ${p.id}::uuid`;
    expect(await matching("intactword")).not.toContain(p.id);
    const { runSearchIndexRebuild } = await import("@/server/services/search.service");
    await runSearchIndexRebuild();
    expect(await matching("intactword")).toContain(p.id);
    expect(await matching("staleword")).not.toContain(p.id);
  });
});
