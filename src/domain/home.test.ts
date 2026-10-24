import { describe, expect, it } from "vitest";
import {
  FEATURED_TAG,
  HOME_RAILS,
  HOME_RAIL_SIZE,
  RAIL_SPECS,
  foldBrandStrip,
  pickHero,
  railFilters,
} from "./home";
import { SORTS } from "./listing";

const p = (id: string, type = "PHYSICAL") => ({ id, type });

describe("home rails", () => {
  it("lists every rail once and gives each a valid sort", () => {
    expect(new Set(HOME_RAILS).size).toBe(HOME_RAILS.length);
    expect(Object.keys(RAIL_SPECS).sort()).toEqual([...HOME_RAILS].sort());
    for (const key of HOME_RAILS) expect(SORTS).toContain(RAIL_SPECS[key].sort);
  });

  it("only offers what can be bought: every rail filters to in-stock", () => {
    for (const key of HOME_RAILS) expect(railFilters(key).inStock).toBe(true);
  });

  it("selects each rail the way its name says", () => {
    expect(railFilters("bestSellers").sort).toBe("best-selling");
    expect(railFilters("newArrivals").sort).toBe("newest");
    expect(railFilters("mostViewed").sort).toBe("popular");
    expect(railFilters("deals")).toMatchObject({ onSale: true, sort: "discount" });
    expect(railFilters("featured").tags).toEqual([FEATURED_TAG]);
    // Only the featured rail is tag-restricted, only the deals rail is sale-restricted.
    expect(railFilters("deals").tags).toEqual([]);
    expect(railFilters("bestSellers").onSale).toBe(false);
  });

  it("always starts on page 1 with no spec or brand selection", () => {
    for (const key of HOME_RAILS) {
      const f = railFilters(key);
      expect(f.page).toBe(1);
      expect(f.brands).toEqual([]);
      expect(f.specs).toEqual({});
    }
  });
});

describe("pickHero", () => {
  it("takes the first featured bundle and removes it from the rail", () => {
    const { hero, rail } = pickHero([p("a"), p("b", "BUNDLE"), p("c"), p("d", "BUNDLE")]);
    expect(hero?.id).toBe("b");
    expect(rail.map((x) => x.id)).toEqual(["a", "c", "d"]);
  });

  it("has no hero without a featured bundle and keeps the whole rail", () => {
    const { hero, rail } = pickHero([p("a"), p("b")]);
    expect(hero).toBeNull();
    expect(rail.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("caps the rail at the rail size", () => {
    const many = Array.from({ length: 20 }, (_, i) => p(`x${i}`));
    expect(pickHero(many).rail).toHaveLength(HOME_RAIL_SIZE);
    expect(pickHero(many, 3).rail).toHaveLength(3);
  });

  it("handles an empty list", () => {
    expect(pickHero([])).toEqual({ hero: null, rail: [] });
  });
});

describe("foldBrandStrip", () => {
  const rows = [
    { brandSlug: "asus", topPath: "components", count: 5 },
    { brandSlug: "asus", topPath: "laptops", count: 2 },
    { brandSlug: "asus", topPath: "monitors", count: 2 },
    { brandSlug: "logitech", topPath: "peripherals", count: 4 },
    { brandSlug: "amd", topPath: "components", count: 7 },
  ];
  const all = new Set(["components", "laptops", "monitors", "peripherals"]);

  it("totals each brand and links its strongest top-level category", () => {
    expect(foldBrandStrip(rows, all)).toEqual([
      { brandSlug: "asus", total: 9, topPath: "components" },
      { brandSlug: "amd", total: 7, topPath: "components" },
      { brandSlug: "logitech", total: 4, topPath: "peripherals" },
    ]);
  });

  it("never links to a category that is not in the storefront tree", () => {
    const out = foldBrandStrip(rows, new Set(["laptops"]));
    const asus = out.find((e) => e.brandSlug === "asus");
    // components (5) is not linkable, so the best linkable one is laptops, and the total still counts everything.
    expect(asus).toEqual({ brandSlug: "asus", total: 9, topPath: "laptops" });
    expect(out.find((e) => e.brandSlug === "amd")?.topPath).toBeNull();
  });

  it("breaks category ties alphabetically and brand ties by slug", () => {
    const out = foldBrandStrip(
      [
        { brandSlug: "b", topPath: "monitors", count: 3 },
        { brandSlug: "b", topPath: "laptops", count: 3 },
        { brandSlug: "a", topPath: "laptops", count: 6 },
      ],
      all,
    );
    expect(out.map((e) => e.brandSlug)).toEqual(["a", "b"]);
    expect(out[1]?.topPath).toBe("laptops");
  });

  it("respects the limit and handles no rows", () => {
    expect(foldBrandStrip(rows, all, 2)).toHaveLength(2);
    expect(foldBrandStrip([], all)).toEqual([]);
  });
});
