/**
 * Sample promo codes for testing: DATA ONLY. The promo engine and its tables arrive in M6a, so the seed validates this
 * file but does not insert it yet. Dates are UTC. One code per order (no stacking) is the approved default.
 */
export type SeedPromoCode = {
  code: string;
  description: string;
  kind: "PERCENT" | "FIXED";
  /** PERCENT: basis points (1000 = 10%). FIXED: whole EGP. */
  value: number;
  minOrderEgp?: number;
  /** Cap for PERCENT codes, whole EGP. */
  maxDiscountEgp?: number;
  startsAt: string;
  /** null = no expiry. */
  expiresAt: string | null;
  usageLimit?: number;
  perUserLimit?: number;
  /** Only items in these categories (paths) qualify. */
  categoryPaths?: readonly string[];
  /** What a tester should expect. */
  expectation: "valid" | "expired" | "limited";
};

export const promoCodes: readonly SeedPromoCode[] = [
  {
    code: "WELCOME10",
    description: "10% off, capped at 500 EGP, for orders of 2,000 EGP or more.",
    kind: "PERCENT",
    value: 1000,
    minOrderEgp: 2000,
    maxDiscountEgp: 500,
    startsAt: "2026-01-01T00:00:00Z",
    expiresAt: null,
    perUserLimit: 1,
    expectation: "valid",
  },
  {
    code: "SAVE200",
    description: "200 EGP off orders of 3,000 EGP or more.",
    kind: "FIXED",
    value: 200,
    minOrderEgp: 3000,
    startsAt: "2026-01-01T00:00:00Z",
    expiresAt: "2027-12-31T23:59:59Z",
    expectation: "valid",
  },
  {
    code: "PERIPHERALS15",
    description: "15% off keyboards, mice, headsets and webcams.",
    kind: "PERCENT",
    value: 1500,
    maxDiscountEgp: 800,
    startsAt: "2026-01-01T00:00:00Z",
    expiresAt: "2027-12-31T23:59:59Z",
    categoryPaths: ["peripherals"],
    expectation: "valid",
  },
  {
    code: "SUMMER2026",
    description: "Expired seasonal code (15% off). Use it to test the expired-code message.",
    kind: "PERCENT",
    value: 1500,
    startsAt: "2026-06-01T00:00:00Z",
    expiresAt: "2026-08-31T23:59:59Z",
    expectation: "expired",
  },
  {
    code: "FIRST100",
    description: "300 EGP off for the first 100 redemptions. Use it to test usage limits.",
    kind: "FIXED",
    value: 300,
    minOrderEgp: 4000,
    startsAt: "2026-01-01T00:00:00Z",
    expiresAt: "2027-12-31T23:59:59Z",
    usageLimit: 100,
    perUserLimit: 1,
    expectation: "limited",
  },
];
