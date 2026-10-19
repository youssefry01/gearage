import { describe, expect, it } from "vitest";
import * as prismaEnums from "@/generated/prisma/enums";
import {
  activationProblems,
  canTransitionStatus,
  CatalogError,
  isPubliclyVisible,
  isValidGtin,
  isValidSlug,
  normalizeSku,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  slugify,
} from "./catalog";
import { SPEC_FACETS, SPEC_TYPES } from "./specs";

describe("domain enums stay in sync with the Prisma enums", () => {
  const same = (domain: readonly string[], prisma: Record<string, string>) =>
    expect([...domain].sort()).toEqual(Object.values(prisma).sort());
  it("product type, status, spec type and facet", () => {
    same(PRODUCT_TYPES, prismaEnums.ProductType);
    same(PRODUCT_STATUSES, prismaEnums.ProductStatus);
    same(SPEC_TYPES, prismaEnums.SpecType);
    same(SPEC_FACETS, prismaEnums.SpecFacet);
  });
});

describe("slugify", () => {
  it("makes lowercase hyphenated ASCII from an English title", () => {
    expect(slugify("AMD Ryzen 5 7600X")).toBe("amd-ryzen-5-7600x");
    expect(slugify("  Corsair  RM750e (2023)  ")).toBe("corsair-rm750e-2023");
    expect(slugify("Gigabyte B650 AORUS ELITE AX V2 & Cooler")).toBe(
      "gigabyte-b650-aorus-elite-ax-v2-and-cooler",
    );
    expect(slugify("Créme Brûlée")).toBe("creme-brulee");
  });
  it("always produces a valid slug and caps the length at a word boundary", () => {
    const long = slugify("word ".repeat(40));
    expect(isValidSlug(long)).toBe(true);
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith("-")).toBe(false);
  });
  it("refuses text with no latin letters or digits (Arabic-only titles are not slugged)", () => {
    expect(() => slugify("معالج رايزن")).toThrow(CatalogError);
    expect(() => slugify("   ")).toThrow(CatalogError);
  });
  it("validates slug shape", () => {
    for (const ok of ["a", "a-b", "rtx-4060", "a1-b2-c3"]) expect(isValidSlug(ok)).toBe(true);
    for (const bad of ["", "-a", "a-", "a--b", "A-b", "a_b", "a b"])
      expect(isValidSlug(bad)).toBe(false);
  });
});

describe("normalizeSku", () => {
  it("upper-cases and joins spaces", () => {
    expect(normalizeSku(" amd-7600x ")).toBe("AMD-7600X");
    expect(normalizeSku("asus rog strix")).toBe("ASUS-ROG-STRIX");
    expect(normalizeSku("a.b_c-1")).toBe("A.B_C-1");
  });
  it("rejects values the database would reject", () => {
    for (const bad of ["", "-X", "a/b", "x".repeat(65), "ü"])
      expect(() => normalizeSku(bad)).toThrow(CatalogError);
  });
});

describe("isValidGtin", () => {
  it("accepts real barcodes with a correct check digit", () => {
    expect(isValidGtin("4006381333931")).toBe(true); // EAN-13
    expect(isValidGtin("73513537")).toBe(true); // EAN-8
    expect(isValidGtin("036000291452")).toBe(true); // UPC-A
    expect(isValidGtin("10012345678902")).toBe(true); // GTIN-14
  });
  it("rejects a wrong check digit, a wrong length or non-digits", () => {
    expect(isValidGtin("4006381333932")).toBe(false);
    expect(isValidGtin("12345")).toBe(false);
    expect(isValidGtin("40063813339X1")).toBe(false);
    expect(isValidGtin("")).toBe(false);
  });
});

describe("status", () => {
  it("allows every change between different states and no no-ops", () => {
    expect(canTransitionStatus("DRAFT", "ACTIVE")).toBe(true);
    expect(canTransitionStatus("ACTIVE", "ARCHIVED")).toBe(true);
    expect(canTransitionStatus("ARCHIVED", "ACTIVE")).toBe(true);
    expect(canTransitionStatus("ACTIVE", "ACTIVE")).toBe(false);
  });
  it("is visible only when ACTIVE and not deleted", () => {
    expect(isPubliclyVisible({ status: "ACTIVE", deletedAt: null })).toBe(true);
    expect(isPubliclyVisible({ status: "ACTIVE", deletedAt: new Date() })).toBe(false);
    expect(isPubliclyVisible({ status: "DRAFT", deletedAt: null })).toBe(false);
    expect(isPubliclyVisible({ status: "ARCHIVED", deletedAt: null })).toBe(false);
  });
});

describe("activationProblems", () => {
  const ok = { type: "PHYSICAL", price: 100, titleEn: "A", titleAr: "ب" } as const;
  it("is empty for a complete product", () => expect(activationProblems(ok)).toEqual([]));
  it("flags missing price and titles", () => {
    expect(activationProblems({ ...ok, price: null })).toEqual(["MISSING_PRICE"]);
    expect(activationProblems({ ...ok, titleAr: " " })).toEqual(["MISSING_TITLE"]);
  });
  it("a discount-priced bundle needs no stored price, but needs at least two components", () => {
    const bundle = { ...ok, type: "BUNDLE", price: null, derivedPrice: true } as const;
    expect(activationProblems({ ...bundle, bundleComponentCount: 5 })).toEqual([]);
    expect(activationProblems({ ...bundle, bundleComponentCount: 1 })).toEqual([
      "BUNDLE_NEEDS_COMPONENTS",
    ]);
    expect(activationProblems(bundle)).toEqual(["BUNDLE_NEEDS_COMPONENTS"]);
  });
});
