import { allocate, mulQty, percentOfBps, sub, sum, type Piastres } from "./money";

export type BundleComponent = {
  productId: string;
  quantity: number;
  /** Current unit price of the component, in piastres. */
  unitPrice: Piastres;
  /** Unit cost when known (null/undefined = unknown). */
  unitCost?: Piastres | null;
};

export type BundlePricing =
  | { mode: "FIXED"; price: Piastres }
  | { mode: "DISCOUNT_PERCENT"; bps: number }
  | { mode: "DISCOUNT_FIXED"; amount: Piastres };

export type PricingWarning = "PRICE_EXCEEDS_PARTS" | "DISCOUNT_EXCEEDS_TOTAL";

export type BundleQuote = {
  /** What the parts cost bought separately, at current prices. */
  listTotal: Piastres;
  /** What the bundle costs. */
  price: Piastres;
  /** "You save X": never negative. */
  savings: Piastres;
  /** Savings as basis points of the list total (0 when there is none). */
  savingsBps: number;
  warnings: PricingWarning[];
};

/** Sum of component unit price times quantity. */
export const listTotal = (components: readonly BundleComponent[]): Piastres =>
  sum(components.map((c) => mulQty(c.unitPrice, c.quantity)));

/**
 * Quotes a bundle from CURRENT component prices, so "you save X" is recomputed whenever a component price changes
 * (nothing about it is stored on the bundle except the pricing mode and its parameter).
 */
export function quoteBundle(
  pricing: BundlePricing,
  components: readonly BundleComponent[],
): BundleQuote {
  const total = listTotal(components);
  const warnings: PricingWarning[] = [];
  let price: Piastres;

  switch (pricing.mode) {
    case "FIXED":
      price = pricing.price;
      if (price > total) warnings.push("PRICE_EXCEEDS_PARTS");
      break;
    case "DISCOUNT_PERCENT":
      price = sub(total, percentOfBps(total, pricing.bps));
      break;
    case "DISCOUNT_FIXED":
      if (pricing.amount > total) warnings.push("DISCOUNT_EXCEEDS_TOTAL");
      price = Math.max(sub(total, pricing.amount), 0);
      break;
  }

  const savings = Math.max(sub(total, price), 0);
  const savingsBps = total === 0 ? 0 : Math.round((savings * 10_000) / total);
  return { listTotal: total, price, savings, savingsBps, warnings };
}

export type Margin = {
  costKnown: boolean;
  cost: Piastres | null;
  margin: Piastres | null;
  marginBps: number | null;
};

/** Margin preview for the admin: needs every component cost; otherwise it says so instead of guessing. */
export function bundleMargin(price: Piastres, components: readonly BundleComponent[]): Margin {
  if (components.length === 0 || components.some((c) => c.unitCost == null)) {
    return { costKnown: false, cost: null, margin: null, marginBps: null };
  }
  const cost = sum(components.map((c) => mulQty(c.unitCost ?? 0, c.quantity)));
  const margin = sub(price, cost);
  return {
    costKnown: true,
    cost,
    margin,
    marginBps: price === 0 ? null : Math.round((margin * 10_000) / price),
  };
}

export type ComponentShare = { productId: string; quantity: number; amount: Piastres };

/**
 * Allocates an amount of a bundle LINE (the line price, its VAT, its promo share, its cost) to the components in
 * proportion to their list value, summing exactly. A bundle sold as one item is invoiced, refunded and restocked
 * per component, so each component needs its own share. `bundleQuantity` scales the component quantities.
 */
export function allocateToComponents(
  amount: Piastres,
  components: readonly BundleComponent[],
  bundleQuantity = 1,
): ComponentShare[] {
  if (components.length === 0) throw new Error("a bundle line needs components to allocate to");
  const value = components.map((c) => c.unitPrice * c.quantity * bundleQuantity);
  // Free components (all list values zero) fall back to splitting by quantity.
  const weights = value.some((v) => v > 0)
    ? value
    : components.map((c) => c.quantity * bundleQuantity);
  const parts = allocate(amount, weights);
  return components.map((c, i) => ({
    productId: c.productId,
    quantity: c.quantity * bundleQuantity,
    amount: parts[i] ?? 0,
  }));
}

/** "Was 55,000, now 48,500": savings against the compare-at price, or null when there is no real discount. */
export function compareAtSavings(
  price: Piastres,
  compareAtPrice: Piastres | null,
): { savings: Piastres; percent: number } | null {
  if (compareAtPrice === null || compareAtPrice <= price) return null;
  const savings = compareAtPrice - price;
  return { savings, percent: Math.round((savings * 100) / compareAtPrice) };
}
