import { describe, expect, it } from "vitest";
import {
  add,
  allocate,
  applyDiscountBps,
  assertPiastres,
  formatPrice,
  fromPounds,
  MAX_PIASTRES,
  mulQty,
  netFromGross,
  percentOfBps,
  sub,
  sum,
  toPounds,
  vatFromGross,
  VAT_RATE_BPS,
} from "./money";

/** Small seeded PRNG so the "random" tests are reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("piastres", () => {
  it("accepts whole numbers in range and rejects everything else", () => {
    expect(assertPiastres(0)).toBe(0);
    expect(assertPiastres(MAX_PIASTRES)).toBe(MAX_PIASTRES);
    for (const bad of [1.5, Number.NaN, Infinity, MAX_PIASTRES + 1, -MAX_PIASTRES - 1]) {
      expect(() => assertPiastres(bad)).toThrow();
    }
  });
  it("converts pounds safely (no float drift)", () => {
    expect(fromPounds(19.99)).toBe(1999);
    expect(fromPounds(0.1 + 0.2)).toBe(30);
    expect(fromPounds(1234.5)).toBe(123450);
    expect(fromPounds(48500)).toBe(4_850_000);
    expect(toPounds(1999)).toBe(19.99);
    expect(() => fromPounds(1.005)).toThrow(/two decimal/);
    expect(() => fromPounds(Number.NaN)).toThrow();
  });
  it("adds, subtracts, sums and multiplies exactly", () => {
    expect(add(1, 2)).toBe(3);
    expect(sub(1, 5)).toBe(-4);
    expect(sum([100, 250, 1])).toBe(351);
    expect(mulQty(1999, 3)).toBe(5997);
    expect(() => mulQty(1, -1)).toThrow();
    expect(() => mulQty(1, 1.5)).toThrow();
    expect(() => add(MAX_PIASTRES, 1)).toThrow();
  });
});

describe("percentOfBps", () => {
  it("computes basis points and rounds half away from zero", () => {
    expect(percentOfBps(10_000, 1400)).toBe(1400);
    expect(percentOfBps(1, 5000)).toBe(1); // 0.5 -> 1
    expect(percentOfBps(3, 5000)).toBe(2); // 1.5 -> 2
    expect(percentOfBps(-3, 5000)).toBe(-2);
    expect(percentOfBps(999, 0)).toBe(0);
    expect(percentOfBps(999, 10_000)).toBe(999);
    expect(applyDiscountBps(48_500_00, 1000)).toBe(43_650_00);
  });
  it("rejects invalid basis points", () => {
    for (const bad of [-1, 10_001, 1.5]) expect(() => percentOfBps(100, bad)).toThrow();
  });
  it("is exact for large amounts (no float rounding)", () => {
    expect(percentOfBps(MAX_PIASTRES, 3333)).toBe(
      Number((BigInt(MAX_PIASTRES) * 3333n * 2n + 10_000n) / 20_000n),
    );
  });
});

describe("allocate (largest remainder)", () => {
  it("splits with the leftover going to the biggest remainders", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(10, [3, 3])).toEqual([5, 5]);
    expect(allocate(7, [1, 2, 4])).toEqual([1, 2, 4]);
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
  });
  it("gives a zero weight nothing", () => {
    expect(allocate(99, [0, 1, 1])).toEqual([0, 50, 49]);
  });
  it("keeps the sign of a negative total (refunds)", () => {
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });
  it("rejects bad input", () => {
    expect(() => allocate(100, [])).toThrow();
    expect(() => allocate(100, [0, 0])).toThrow();
    expect(() => allocate(100, [1, -1])).toThrow();
    expect(() => allocate(100, [1.5])).toThrow();
    expect(() => allocate(1.5, [1])).toThrow();
  });
  it("PROPERTY: parts always add up EXACTLY and stay within one piastre of the exact share", () => {
    const rnd = mulberry32(2026);
    for (let trial = 0; trial < 2000; trial++) {
      const n = 1 + Math.floor(rnd() * 8);
      const weights = Array.from({ length: n }, () => Math.floor(rnd() * 5_000_000));
      if (weights.every((w) => w <= 0)) weights[0] = 1;
      const total = Math.floor(rnd() * 400_000_00) * (rnd() < 0.2 ? -1 : 1);
      const parts = allocate(total, weights);
      expect(parts.reduce((s, p) => s + p, 0)).toBe(total);
      const sumW = weights.reduce((s, w) => s + w, 0);
      parts.forEach((p, i) => {
        const exact = (total * (weights[i] as number)) / sumW;
        expect(Math.abs(p - exact)).toBeLessThan(1 + 1e-6);
        if (weights[i] === 0) expect(p).toBe(0);
      });
    }
  });
});

describe("VAT", () => {
  it("extracts the VAT from a VAT-inclusive price", () => {
    expect(VAT_RATE_BPS.STANDARD).toBe(1400);
    expect(vatFromGross(11_400, 1400)).toBe(1_400);
    expect(vatFromGross(114, 1400)).toBe(14);
    expect(vatFromGross(100, 1400)).toBe(12); // 12.28 rounds down
    expect(vatFromGross(5_000, 0)).toBe(0);
    expect(netFromGross(11_400, 1400)).toBe(10_000);
  });
  it("net + VAT always equals gross", () => {
    const rnd = mulberry32(14);
    for (let i = 0; i < 500; i++) {
      const gross = Math.floor(rnd() * 5_000_000);
      expect(netFromGross(gross, 1400) + vatFromGross(gross, 1400)).toBe(gross);
    }
  });
});

describe("formatPrice", () => {
  it("shows whole pounds without decimals and keeps piastres when present", () => {
    expect(formatPrice(48_500_00, "en")).toMatch(/^EGP\s?48,500$/);
    expect(formatPrice(48_500_50, "en")).toMatch(/^EGP\s?48,500\.50$/);
    expect(formatPrice(0, "en")).toMatch(/^EGP\s?0$/);
  });
  it("uses Western digits in Arabic too", () => {
    const text = formatPrice(48_500_00, "ar");
    expect(text).toContain("48,500");
    expect(text).not.toMatch(/[\u0660-\u0669]/);
  });
});
