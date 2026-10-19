import { describe, expect, it } from "vitest";
import {
  allocateToComponents,
  bundleMargin,
  compareAtSavings,
  listTotal,
  quoteBundle,
  type BundleComponent,
} from "./pricing";

const parts: BundleComponent[] = [
  { productId: "cpu", quantity: 1, unitPrice: 12_000_00, unitCost: 10_000_00 },
  { productId: "gpu", quantity: 1, unitPrice: 18_000_00, unitCost: 15_000_00 },
  { productId: "ram", quantity: 2, unitPrice: 1_500_00, unitCost: 1_200_00 },
];
// list total = 12,000 + 18,000 + 3,000 = 33,000 EGP

describe("listTotal", () => {
  it("is the sum of unit price times quantity", () => {
    expect(listTotal(parts)).toBe(33_000_00);
    expect(listTotal([])).toBe(0);
  });
});

describe("quoteBundle", () => {
  it("FIXED: price as set, savings against the parts", () => {
    const q = quoteBundle({ mode: "FIXED", price: 30_000_00 }, parts);
    expect(q).toMatchObject({
      listTotal: 33_000_00,
      price: 30_000_00,
      savings: 3_000_00,
      warnings: [],
    });
    expect(q.savingsBps).toBe(909); // 3,000 / 33,000 = 9.09%
  });
  it("FIXED: a price above the parts total gives zero savings and a warning", () => {
    const q = quoteBundle({ mode: "FIXED", price: 40_000_00 }, parts);
    expect(q.savings).toBe(0);
    expect(q.warnings).toEqual(["PRICE_EXCEEDS_PARTS"]);
  });
  it("DISCOUNT_PERCENT: follows component prices when they change", () => {
    const pricing = { mode: "DISCOUNT_PERCENT", bps: 1000 } as const; // 10%
    expect(quoteBundle(pricing, parts)).toMatchObject({ price: 29_700_00, savings: 3_300_00 });
    const cheaperGpu = parts.map((p) =>
      p.productId === "gpu" ? { ...p, unitPrice: 16_000_00 } : p,
    );
    expect(quoteBundle(pricing, cheaperGpu)).toMatchObject({
      listTotal: 31_000_00,
      price: 27_900_00,
      savings: 3_100_00,
    });
  });
  it("DISCOUNT_FIXED: subtracts a fixed amount, never below zero", () => {
    expect(quoteBundle({ mode: "DISCOUNT_FIXED", amount: 2_500_00 }, parts)).toMatchObject({
      price: 30_500_00,
      savings: 2_500_00,
    });
    const q = quoteBundle({ mode: "DISCOUNT_FIXED", amount: 99_000_00 }, parts);
    expect(q.price).toBe(0);
    expect(q.warnings).toEqual(["DISCOUNT_EXCEEDS_TOTAL"]);
  });
  it("handles a bundle with no components without dividing by zero", () => {
    expect(quoteBundle({ mode: "FIXED", price: 100 }, [])).toMatchObject({
      listTotal: 0,
      savings: 0,
      savingsBps: 0,
    });
  });
});

describe("bundleMargin", () => {
  it("computes cost and margin when every cost is known", () => {
    const m = bundleMargin(30_000_00, parts);
    expect(m).toEqual({ costKnown: true, cost: 27_400_00, margin: 2_600_00, marginBps: 867 });
  });
  it("says so instead of guessing when a cost is missing", () => {
    const missing = parts.map((p) => (p.productId === "ram" ? { ...p, unitCost: null } : p));
    expect(bundleMargin(30_000_00, missing)).toEqual({
      costKnown: false,
      cost: null,
      margin: null,
      marginBps: null,
    });
    expect(bundleMargin(1, []).costKnown).toBe(false);
  });
});

describe("allocateToComponents", () => {
  it("allocates in proportion to list value and sums exactly", () => {
    const shares = allocateToComponents(30_000_00, parts);
    expect(shares.reduce((s, x) => s + x.amount, 0)).toBe(30_000_00);
    expect(shares.map((s) => s.productId)).toEqual(["cpu", "gpu", "ram"]);
    // gpu is 18/33 of the list value
    expect(shares[1]?.amount).toBe(Math.round((30_000_00 * 18_000_00) / 33_000_00));
  });
  it("scales for several bundles on one line and keeps the quantities", () => {
    const shares = allocateToComponents(60_000_00, parts, 2);
    expect(shares.reduce((s, x) => s + x.amount, 0)).toBe(60_000_00);
    expect(shares.find((s) => s.productId === "ram")?.quantity).toBe(4);
  });
  it("the same weights split price, VAT and a promo share consistently", () => {
    const price = allocateToComponents(30_000_00, parts);
    const vat = allocateToComponents(3_684_21, parts);
    const promo = allocateToComponents(-500_00, parts);
    expect(vat.reduce((s, x) => s + x.amount, 0)).toBe(3_684_21);
    expect(promo.reduce((s, x) => s + x.amount, 0)).toBe(-500_00);
    expect(price).toHaveLength(vat.length);
  });
  it("falls back to quantity when every component is free, and refuses an empty bundle", () => {
    const free: BundleComponent[] = [
      { productId: "a", quantity: 1, unitPrice: 0 },
      { productId: "b", quantity: 3, unitPrice: 0 },
    ];
    expect(allocateToComponents(100, free).map((s) => s.amount)).toEqual([25, 75]);
    expect(() => allocateToComponents(100, [])).toThrow();
  });
});

describe("compareAtSavings", () => {
  it("returns the saving only when compare-at is genuinely higher", () => {
    expect(compareAtSavings(48_500_00, 55_000_00)).toEqual({ savings: 6_500_00, percent: 12 });
    expect(compareAtSavings(48_500_00, 48_500_00)).toBeNull();
    expect(compareAtSavings(48_500_00, 40_000_00)).toBeNull();
    expect(compareAtSavings(48_500_00, null)).toBeNull();
  });
});
