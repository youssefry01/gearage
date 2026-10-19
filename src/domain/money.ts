/**
 * Money is an integer number of PIASTRES (1 EGP = 100). Never a float, never a string. The database stores it in an
 * INTEGER column, so the safe range matches PostgreSQL's (about 21.4 million EGP). Everything here is pure.
 */
export type Piastres = number;

export const PIASTRES_PER_POUND = 100;
/** Largest value a PostgreSQL INTEGER column can hold. */
export const MAX_PIASTRES: Piastres = 2_147_483_647;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export function assertPiastres(value: number, label = "amount"): Piastres {
  if (!Number.isInteger(value))
    throw new MoneyError(`${label} must be a whole number of piastres, got ${value}`);
  if (Math.abs(value) > MAX_PIASTRES)
    throw new MoneyError(`${label} is outside the supported range: ${value}`);
  return value;
}

/** Pounds (at most 2 decimals) to piastres, safely: 19.99 -> 1999 (never 1998.9999999999998). */
export function fromPounds(pounds: number): Piastres {
  if (!Number.isFinite(pounds)) throw new MoneyError(`not a finite amount: ${pounds}`);
  const scaled = pounds * PIASTRES_PER_POUND;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-6)
    throw new MoneyError(`${pounds} has more than two decimal places`);
  return assertPiastres(rounded);
}

export const toPounds = (p: Piastres): number => assertPiastres(p) / PIASTRES_PER_POUND;

export const add = (a: Piastres, b: Piastres): Piastres => assertPiastres(a + b);
export const sub = (a: Piastres, b: Piastres): Piastres => assertPiastres(a - b);
export const sum = (values: readonly Piastres[]): Piastres =>
  assertPiastres(values.reduce((s, v) => s + v, 0));

export function mulQty(unit: Piastres, quantity: number): Piastres {
  if (!Number.isInteger(quantity) || quantity < 0)
    throw new MoneyError(`quantity must be a non-negative integer, got ${quantity}`);
  return assertPiastres(unit * quantity);
}

/** Round half away from zero, on an exact BigInt division. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = (2n * n + d) / (2n * d);
  return negative ? -q : q;
}

/** `bps` basis points (1/100 of a percent) of an amount, rounded half away from zero. 1400 bps = 14%. */
export function percentOfBps(amount: Piastres, bps: number): Piastres {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000)
    throw new MoneyError(`bps must be an integer from 0 to 10000, got ${bps}`);
  return Number(divRound(BigInt(assertPiastres(amount)) * BigInt(bps), 10_000n));
}

export const applyDiscountBps = (amount: Piastres, bps: number): Piastres =>
  sub(amount, percentOfBps(amount, bps));

/**
 * Splits `total` across `weights` so the parts ADD UP EXACTLY (largest-remainder method). Used to allocate a bundle's
 * price, VAT and promo share to its components, so refunds and invoices per component always reconcile to the cent.
 * Ties go to the earlier weight. Negative totals (refunds) are allocated by magnitude and keep their sign.
 */
export function allocate(total: Piastres, weights: readonly number[]): Piastres[] {
  assertPiastres(total, "total");
  if (weights.length === 0) throw new MoneyError("allocate needs at least one weight");
  if (weights.some((w) => !Number.isInteger(w) || w < 0))
    throw new MoneyError("weights must be non-negative integers");
  const sumW = weights.reduce((s, w) => s + BigInt(w), 0n);
  if (sumW === 0n) throw new MoneyError("at least one weight must be positive");

  const magnitude = BigInt(Math.abs(total));
  const shares = weights.map((w, index) => {
    const exact = magnitude * BigInt(w);
    return { index, base: exact / sumW, remainder: exact % sumW };
  });
  let leftover = magnitude - shares.reduce((s, x) => s + x.base, 0n);
  const byRemainder = [...shares].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  );
  const extra = new Set<number>();
  for (const s of byRemainder) {
    if (leftover === 0n) break;
    extra.add(s.index);
    leftover -= 1n;
  }
  const sign = total < 0 ? -1 : 1;
  return shares.map((s) => sign * Number(s.base + (extra.has(s.index) ? 1n : 0n)));
}

/** Egyptian VAT classes, in basis points. Rates are configuration to confirm with the accountant before launch. */
export const VAT_RATE_BPS = { STANDARD: 1400, ZERO: 0, EXEMPT: 0 } as const;
export type VatClass = keyof typeof VAT_RATE_BPS;

/** The VAT contained in a VAT-INCLUSIVE price: gross * rate / (1 + rate). */
export function vatFromGross(gross: Piastres, rateBps: number): Piastres {
  if (!Number.isInteger(rateBps) || rateBps < 0)
    throw new MoneyError(`invalid VAT rate: ${rateBps}`);
  return Number(
    divRound(BigInt(assertPiastres(gross)) * BigInt(rateBps), 10_000n + BigInt(rateBps)),
  );
}

export const netFromGross = (gross: Piastres, rateBps: number): Piastres =>
  sub(gross, vatFromGross(gross, rateBps));

/**
 * Display price. English shows "EGP 48,500" (code, so it is unambiguous), Arabic the localized symbol. Western digits
 * in both (ADR 0006). Fractions are shown only when there are piastres.
 */
export function formatPrice(amount: Piastres, locale: string): string {
  assertPiastres(amount);
  const whole = amount % PIASTRES_PER_POUND === 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EGP",
    currencyDisplay: locale.startsWith("ar") ? "symbol" : "code",
    numberingSystem: "latn",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount / PIASTRES_PER_POUND);
}
