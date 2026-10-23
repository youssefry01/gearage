import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  activeFilterCount,
  cardSavings,
  listingQuery,
  listingSeo,
  clearedFilters,
  pageWindow,
  parseListingParams,
  withPage,
  withSort,
  withoutSelection,
  parseRange,
  specsMatch,
  totalPages,
} from "./listing";
import type { SpecDef } from "./specs";

const def = (over: Partial<SpecDef> & Pick<SpecDef, "key" | "type" | "facet">): SpecDef => ({
  labelEn: over.key,
  labelAr: over.key,
  required: false,
  filterable: true,
  ...over,
});

const DEFS: SpecDef[] = [
  def({
    key: "socket",
    type: "ENUM",
    facet: "CHECKBOX",
    options: [
      { value: "AM5", labelEn: "AM5", labelAr: "AM5" },
      { value: "LGA1700", labelEn: "LGA1700", labelAr: "LGA1700" },
    ],
  }),
  def({ key: "cores", type: "NUMBER", facet: "RANGE" }),
  def({ key: "integrated_graphics", type: "BOOLEAN", facet: "TOGGLE" }),
  def({ key: "connectivity", type: "STRING_LIST", facet: "CHECKBOX" }),
  def({ key: "hidden", type: "NUMBER", facet: "RANGE", filterable: false }),
];

describe("parseListingParams", () => {
  it("returns defaults for no parameters", () => {
    const f = parseListingParams({}, DEFS);
    expect(f).toEqual({
      brands: [],
      tags: [],
      inStock: false,
      onSale: false,
      specs: {},
      sort: "popular",
      page: 1,
    });
    expect(listingQuery(f)).toBe("");
  });

  it("accepts repeated and single values, sorts and de-duplicates them", () => {
    const f = parseListingParams({ brand: ["msi", "asus", "msi"], tag: "gaming" }, DEFS);
    expect(f.brands).toEqual(["asus", "msi"]);
    expect(f.tags).toEqual(["gaming"]);
  });

  it("drops invalid slugs, unknown sorts, bad pages and bad prices without throwing", () => {
    const f = parseListingParams(
      {
        brand: ["ok-brand", "NOT A SLUG", "../x"],
        sort: "random",
        page: "abc",
        price_min: "-5",
        price_max: "1e9",
      },
      DEFS,
    );
    expect(f.brands).toEqual(["ok-brand"]);
    expect(f.sort).toBe("popular");
    expect(f.page).toBe(1);
    expect(f.priceMin).toBeUndefined();
    expect(f.priceMax).toBeUndefined();
  });

  it("converts whole EGP to piastres and swaps a reversed price range", () => {
    const f = parseListingParams({ price_min: "9000", price_max: "5000" }, DEFS);
    expect(f.priceMin).toBe(500_000);
    expect(f.priceMax).toBe(900_000);
  });

  it("clamps the page", () => {
    expect(parseListingParams({ page: "0" }).page).toBe(1);
    expect(parseListingParams({ page: "99999" }).page).toBe(1); // 5 digits: rejected
    expect(parseListingParams({ page: "3" }).page).toBe(3);
  });

  it("honours only filterable specs, and only real ENUM options", () => {
    const f = parseListingParams(
      {
        "spec.socket": ["AM5", "BOGUS"],
        "spec.cores": "8..16",
        "spec.integrated_graphics": "1",
        "spec.hidden": "1..2",
        "spec.unknown": "x",
      },
      DEFS,
    );
    expect(f.specs).toEqual({
      socket: { values: ["AM5"] },
      cores: { min: 8, max: 16 },
      integrated_graphics: { on: true },
    });
    expect(parseListingParams({ "spec.socket": "BOGUS" }, DEFS).specs).toEqual({});
  });

  it("accepts any non-empty value for list specs without options", () => {
    const f = parseListingParams({ "spec.connectivity": ["Bluetooth", "2.4 GHz"] }, DEFS);
    expect(f.specs.connectivity).toEqual({ values: ["2.4 GHz", "Bluetooth"] });
  });
});

describe("parseRange", () => {
  it("parses closed, open and exact ranges", () => {
    expect(parseRange("8..16")).toEqual({ min: 8, max: 16 });
    expect(parseRange("8..")).toEqual({ min: 8 });
    expect(parseRange("..16")).toEqual({ max: 16 });
    expect(parseRange("12")).toEqual({ min: 12, max: 12 });
    expect(parseRange("2.5..3.5")).toEqual({ min: 2.5, max: 3.5 });
  });
  it("swaps reversed bounds and rejects junk", () => {
    expect(parseRange("16..8")).toEqual({ min: 8, max: 16 });
    for (const bad of ["..", "a..b", "1..2..3", "", "1e3..5"])
      expect(parseRange(bad)).toBeUndefined();
  });
});

describe("listingQuery (canonical form)", () => {
  it("is order-independent and drops defaults", () => {
    const a = parseListingParams(
      { sort: "price-asc", "spec.cores": "8..16", brand: ["msi", "asus"], page: "1" },
      DEFS,
    );
    const b = parseListingParams(
      { page: "1", brand: ["asus", "msi"], "spec.cores": "8..16", sort: "price-asc" },
      DEFS,
    );
    expect(listingQuery(a)).toBe(listingQuery(b));
    expect(listingQuery(a)).toBe("?brand=asus&brand=msi&spec.cores=8..16&sort=price-asc");
  });

  it("round-trips through parse", () => {
    const f = parseListingParams(
      {
        brand: "amd",
        tag: "gaming",
        price_min: "1000",
        in_stock: "1",
        sale: "1",
        "spec.socket": "AM5",
        "spec.cores": "..12",
        "spec.integrated_graphics": "1",
        sort: "newest",
        page: "4",
      },
      DEFS,
    );
    const query = listingQuery(f);
    const again = parseListingParams(Object.fromEntries(new URLSearchParams(query)), DEFS);
    expect(again).toEqual(f);
  });

  it("can omit the page (for links that change filters and reset to page 1)", () => {
    const f = parseListingParams({ brand: "amd", page: "3" }, DEFS);
    expect(listingQuery(f, { page: false })).toBe("?brand=amd");
    expect(listingQuery(f)).toBe("?brand=amd&page=3");
  });
});

describe("activeFilterCount", () => {
  it("counts facet selections, not sort or page", () => {
    const f = parseListingParams(
      {
        brand: ["a", "b"],
        price_min: "1",
        price_max: "9",
        in_stock: "1",
        sort: "newest",
        page: "2",
      },
      DEFS,
    );
    expect(activeFilterCount(f)).toBe(4); // 2 brands + price + in stock
  });
});

describe("listingSeo (index policy)", () => {
  const seo = (raw: Record<string, string | string[]>) => listingSeo(parseListingParams(raw, DEFS));

  it("indexes the clean URL and plain pagination, with hreflang", () => {
    expect(seo({})).toMatchObject({ indexable: true, hreflang: true, canonicalQuery: "" });
    expect(seo({ page: "2" })).toMatchObject({
      indexable: true,
      hreflang: true,
      canonicalQuery: "?page=2",
      nofollowPagination: false,
    });
  });

  it("canonicalizes page=1, tracking and unknown parameters away", () => {
    expect(seo({ page: "1", utm_source: "x", foo: "bar" })).toMatchObject({
      indexable: true,
      canonicalQuery: "",
    });
  });

  it("noindexes filtered and sorted URLs, without hreflang", () => {
    const cases: Record<string, string | string[]>[] = [
      { brand: "msi" },
      { sort: "price-asc" },
      { in_stock: "1" },
      { "spec.cores": "8..16" },
      { price_min: "100" },
    ];
    for (const raw of cases) {
      expect(seo(raw), JSON.stringify(raw)).toMatchObject({
        indexable: false,
        hreflang: false,
        nofollowPagination: true,
      });
    }
  });

  it("ignores invalid filters, so a junk URL stays indexable as the clean page", () => {
    expect(seo({ brand: "NOT A SLUG", sort: "random", "spec.socket": "BOGUS" }).indexable).toBe(
      true,
    );
  });
});

describe("pagination helpers", () => {
  it("computes total pages", () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(PAGE_SIZE)).toBe(1);
    expect(totalPages(PAGE_SIZE + 1)).toBe(2);
  });
  it("builds a window with ellipses", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(7, 20)).toEqual([1, null, 5, 6, 7, 8, 9, null, 20]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 18, 19, 20]);
    expect(pageWindow(4, 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("specsMatch", () => {
  const specs = {
    socket: "AM5",
    cores: 8,
    integrated_graphics: true,
    connectivity: ["Bluetooth", "USB receiver"],
  };
  it("matches any-of, ranges, toggles and lists", () => {
    expect(specsMatch(specs, { socket: { values: ["AM4", "AM5"] } })).toBe(true);
    expect(specsMatch(specs, { socket: { values: ["AM4"] } })).toBe(false);
    expect(specsMatch(specs, { cores: { min: 8, max: 8 } })).toBe(true);
    expect(specsMatch(specs, { cores: { min: 9 } })).toBe(false);
    expect(specsMatch(specs, { integrated_graphics: { on: true } })).toBe(true);
    expect(specsMatch(specs, { connectivity: { values: ["Bluetooth"] } })).toBe(true);
    expect(specsMatch({}, { cores: { min: 1 } })).toBe(false);
    expect(specsMatch({ integrated_graphics: false }, { integrated_graphics: { on: true } })).toBe(
      false,
    );
  });
  it("ANDs different specs", () => {
    expect(specsMatch(specs, { socket: { values: ["AM5"] }, cores: { min: 12 } })).toBe(false);
  });
});

describe("cardSavings", () => {
  it("uses the compare-at price for physical products", () => {
    expect(
      cardSavings({
        type: "PHYSICAL",
        effectivePrice: 80_000,
        listTotal: 80_000,
        compareAtPrice: 100_000,
      }),
    ).toEqual({ amount: 20_000, percent: 20, kind: "compare-at" });
    expect(
      cardSavings({
        type: "PHYSICAL",
        effectivePrice: 80_000,
        listTotal: 80_000,
        compareAtPrice: 80_000,
      }),
    ).toBeNull();
    expect(
      cardSavings({
        type: "PHYSICAL",
        effectivePrice: 80_000,
        listTotal: 80_000,
        compareAtPrice: null,
      }),
    ).toBeNull();
  });
  it("uses the parts total for bundles and ignores compare-at", () => {
    expect(
      cardSavings({
        type: "BUNDLE",
        effectivePrice: 90_000,
        listTotal: 100_000,
        compareAtPrice: 999_999,
      }),
    ).toEqual({ amount: 10_000, percent: 10, kind: "bundle" });
    expect(
      cardSavings({
        type: "BUNDLE",
        effectivePrice: 100_000,
        listTotal: 100_000,
        compareAtPrice: null,
      }),
    ).toBeNull();
  });
});

describe("changing filters", () => {
  const base = () =>
    parseListingParams(
      {
        brand: ["amd", "intel"],
        tag: "gaming",
        price_min: "100",
        in_stock: "1",
        sale: "1",
        "spec.socket": ["AM5", "LGA1700"],
        "spec.cores": "8..16",
        "spec.integrated_graphics": "1",
        sort: "newest",
        page: "3",
      },
      DEFS,
    );

  it("removing a selection returns to page 1 and leaves everything else", () => {
    const f = withoutSelection(base(), { type: "brand", value: "amd" });
    expect(f.brands).toEqual(["intel"]);
    expect(f.page).toBe(1);
    expect(f.sort).toBe("newest");
    expect(f.inStock).toBe(true);
  });
  it("removes tags, price, toggles and individual spec values", () => {
    let f = withoutSelection(base(), { type: "tag", value: "gaming" });
    expect(f.tags).toEqual([]);
    f = withoutSelection(f, { type: "price" });
    expect(f.priceMin).toBeUndefined();
    f = withoutSelection(f, { type: "in_stock" });
    f = withoutSelection(f, { type: "sale" });
    expect([f.inStock, f.onSale]).toEqual([false, false]);
    f = withoutSelection(f, { type: "spec", key: "socket", value: "AM5" });
    expect(f.specs.socket).toEqual({ values: ["LGA1700"] });
    f = withoutSelection(f, { type: "spec", key: "socket", value: "LGA1700" });
    expect(f.specs.socket).toBeUndefined();
    f = withoutSelection(f, { type: "spec", key: "cores" });
    expect(f.specs.cores).toBeUndefined();
  });
  it("does not mutate its input", () => {
    const f = base();
    const snapshot = JSON.stringify(f);
    withoutSelection(f, { type: "spec", key: "socket", value: "AM5" });
    expect(JSON.stringify(f)).toBe(snapshot);
  });
  it("sort resets the page, page keeps filters, clear keeps only the sort", () => {
    expect(withSort(base(), "price-asc")).toMatchObject({ sort: "price-asc", page: 1 });
    expect(withPage(base(), 5)).toMatchObject({ page: 5, brands: ["amd", "intel"] });
    const cleared = clearedFilters(base());
    expect(activeFilterCount(cleared)).toBe(0);
    expect(cleared.sort).toBe("newest");
    expect(listingQuery(cleared)).toBe("?sort=newest");
  });
});
