import { describe, expect, it } from "vitest";
import {
  BUNDLE_GROUP,
  COMPARE_MAX,
  canAddToCompare,
  cellKey,
  compareGroup,
  compareParam,
  hasAnyValue,
  isComparableType,
  makeRow,
  onlyDifferences,
  parseCompareParam,
  selectComparable,
  type CompareCell,
  type CompareSection,
} from "./compare";

const gpu = (slug: string) => ({ slug, group: "cat:components/graphics-cards" });

describe("compareGroup / isComparableType", () => {
  it("groups bundles together and physical products by spec owner", () => {
    expect(compareGroup("BUNDLE", "pc-bundles")).toBe(BUNDLE_GROUP);
    expect(compareGroup("BUNDLE", "anything")).toBe(BUNDLE_GROUP);
    expect(compareGroup("PHYSICAL", "components/cpus")).toBe("cat:components/cpus");
  });
  it("has no group for products that cannot be compared", () => {
    expect(compareGroup("GIFT_CARD", "x")).toBeNull();
    expect(compareGroup("DIGITAL", "x")).toBeNull();
  });
  it("only physical products and bundles can be compared", () => {
    expect(isComparableType("PHYSICAL")).toBe(true);
    expect(isComparableType("BUNDLE")).toBe(true);
    expect(isComparableType("GIFT_CARD")).toBe(false);
    expect(isComparableType("DIGITAL")).toBe(false);
  });
});

describe("canAddToCompare", () => {
  it("accepts the first product and same-group products", () => {
    expect(canAddToCompare([], gpu("a"))).toBe("ok");
    expect(canAddToCompare([gpu("a")], gpu("b"))).toBe("ok");
  });
  it("reports a duplicate before anything else", () => {
    const full = ["a", "b", "c", "d"].map(gpu);
    expect(canAddToCompare(full, gpu("a"))).toBe("duplicate");
  });
  it(`refuses a fifth product (limit ${COMPARE_MAX})`, () => {
    const full = ["a", "b", "c", "d"].map(gpu);
    expect(full).toHaveLength(COMPARE_MAX);
    expect(canAddToCompare(full, gpu("e"))).toBe("full");
  });
  it("refuses a product of another group, bundle against part included", () => {
    expect(canAddToCompare([gpu("a")], { slug: "x", group: "cat:components/cpus" })).toBe(
      "mismatch",
    );
    expect(canAddToCompare([gpu("a")], { slug: "bundle", group: BUNDLE_GROUP })).toBe("mismatch");
    expect(canAddToCompare([{ slug: "bundle", group: BUNDLE_GROUP }], gpu("a"))).toBe("mismatch");
  });
});

describe("parseCompareParam", () => {
  it("splits, trims, dedupes and keeps order", () => {
    expect(parseCompareParam(" a, b ,a,c ")).toEqual({ slugs: ["a", "b", "c"], truncated: false });
  });
  it("drops invalid slugs instead of failing", () => {
    expect(parseCompareParam("ok,../etc/passwd,UPPER,,a b,ok-two").slugs).toEqual(["ok", "ok-two"]);
  });
  it("caps at the limit and says so", () => {
    const r = parseCompareParam("a,b,c,d,e,f");
    expect(r.slugs).toEqual(["a", "b", "c", "d"]);
    expect(r.truncated).toBe(true);
  });
  it("accepts a repeated query parameter and an absent one", () => {
    expect(parseCompareParam(["a,b", "c"]).slugs).toEqual(["a", "b", "c"]);
    expect(parseCompareParam(undefined)).toEqual({ slugs: [], truncated: false });
  });
  it("round-trips with compareParam", () => {
    expect(parseCompareParam(compareParam(["a", "b"])).slugs).toEqual(["a", "b"]);
  });
  it("rejects over-long slugs", () => {
    expect(parseCompareParam("a".repeat(81)).slugs).toEqual([]);
  });
});

describe("selectComparable", () => {
  it("keeps the first product's group, in order, and reports the rest", () => {
    const r = selectComparable([gpu("a"), { slug: "b", group: "cat:components/cpus" }, gpu("c")]);
    expect(r.kept.map((p) => p.slug)).toEqual(["a", "c"]);
    expect(r.dropped.map((p) => p.slug)).toEqual(["b"]);
  });
  it("handles an empty list", () => {
    expect(selectComparable([])).toEqual({ kept: [], dropped: [] });
  });
});

const money = (amount: number): CompareCell => ({ kind: "money", amount });
const text = (en: string): CompareCell => ({ kind: "text", text: { en, ar: en } });

describe("makeRow / cellKey", () => {
  it("marks a row as differing only when values differ", () => {
    expect(makeRow("p", { en: "P", ar: "P" }, [money(100), money(100)]).differs).toBe(false);
    expect(makeRow("p", { en: "P", ar: "P" }, [money(100), money(200)]).differs).toBe(true);
  });
  it("treats a missing value as different from a present one", () => {
    expect(makeRow("x", { en: "X", ar: "X" }, [text("a"), { kind: "none" }]).differs).toBe(true);
    expect(makeRow("x", { en: "X", ar: "X" }, [{ kind: "none" }, { kind: "none" }]).differs).toBe(
      false,
    );
  });
  it("a single product never differs", () => {
    expect(makeRow("x", { en: "X", ar: "X" }, [text("a")]).differs).toBe(false);
  });
  it("compares stock by buyable or not, not by quantity", () => {
    const stock = (available: number | null): CompareCell => ({
      kind: "stock",
      available,
      lowStockThreshold: 5,
    });
    expect(cellKey(stock(3))).toBe(cellKey(stock(40)));
    expect(cellKey(stock(null))).toBe(cellKey(stock(1)));
    expect(cellKey(stock(0))).not.toBe(cellKey(stock(1)));
  });
  it("compares lists regardless of order", () => {
    const list = (...items: string[]): CompareCell => ({
      kind: "spec",
      display: { kind: "list", items },
    });
    expect(cellKey(list("a", "b"))).toBe(cellKey(list("b", "a")));
    expect(cellKey(list("a"))).not.toBe(cellKey(list("a", "b")));
  });
  it("distinguishes numbers by unit and booleans by value", () => {
    const n = (value: number, unit: string | null): CompareCell => ({
      kind: "spec",
      display: { kind: "number", value, unit },
    });
    expect(cellKey(n(8, "GB"))).not.toBe(cellKey(n(8, "W")));
    const b = (value: boolean): CompareCell => ({
      kind: "spec",
      display: { kind: "boolean", value },
    });
    expect(cellKey(b(true))).not.toBe(cellKey(b(false)));
  });
});

describe("hasAnyValue / onlyDifferences", () => {
  it("detects an all-empty row", () => {
    expect(hasAnyValue([{ kind: "none" }, { kind: "none" }])).toBe(false);
    expect(hasAnyValue([{ kind: "none" }, text("a")])).toBe(true);
  });
  it("keeps differing rows and drops empty sections", () => {
    const same = makeRow("same", { en: "S", ar: "S" }, [text("a"), text("a")]);
    const diff = makeRow("diff", { en: "D", ar: "D" }, [text("a"), text("b")]);
    const sections: CompareSection[] = [
      { id: "overview", rows: [same, diff] },
      { id: "specs", rows: [same] },
    ];
    const out = onlyDifferences(sections);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("overview");
    expect(out[0]?.rows.map((r) => r.id)).toEqual(["diff"]);
  });
});
