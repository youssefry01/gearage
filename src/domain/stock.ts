import type { ProductType } from "./catalog";

/** A cart/order line as the stock logic sees it. */
export type StockLine = { productId: string; type: ProductType; quantity: number };

export type BundleComposition = ReadonlyMap<
  string,
  readonly { componentId: string; quantity: number }[]
>;
export type DemandEntry = { productId: string; quantity: number };

export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}

/**
 * Turns cart lines into the PHYSICAL units that must be available, in a DETERMINISTIC order (ascending product id).
 * - bundle lines expand into their components (bundle quantity times component quantity);
 * - the same product appearing on several lines (or inside several bundles) is AGGREGATED, so availability is checked
 *   once against the total demand, never line by line;
 * - gift cards and digital products need no stock.
 * Callers lock inventory rows in this order, which makes concurrent checkouts deadlock-free (ADR 0008).
 */
export function expandDemand(
  lines: readonly StockLine[],
  compositions: BundleComposition,
): DemandEntry[] {
  const demand = new Map<string, number>();
  const bump = (productId: string, quantity: number) =>
    demand.set(productId, (demand.get(productId) ?? 0) + quantity);

  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new StockError(`line quantity must be a positive integer, got ${line.quantity}`);
    }
    if (line.type === "PHYSICAL") {
      bump(line.productId, line.quantity);
    } else if (line.type === "BUNDLE") {
      const items = compositions.get(line.productId);
      if (!items || items.length === 0)
        throw new StockError(`bundle ${line.productId} has no components`);
      for (const item of items) bump(item.componentId, line.quantity * item.quantity);
    }
  }
  return [...demand.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0));
}

export type Shortage = { productId: string; requested: number; available: number };

/** Compares aggregated demand with availability. A product missing from `available` counts as 0. */
export function findShortages(
  demand: readonly DemandEntry[],
  available: ReadonlyMap<string, number>,
): Shortage[] {
  return demand.flatMap((d) => {
    const have = available.get(d.productId) ?? 0;
    return d.quantity > have
      ? [{ productId: d.productId, requested: d.quantity, available: have }]
      : [];
  });
}

export type ComponentAvailability = { available: number; sellable: boolean };

/**
 * How many whole bundles can be sold: min over components of floor(available / quantity), and 0 when a component is
 * not sellable (archived, draft or deleted). This is the TypeScript twin of the product_availability SQL view; a DB
 * test asserts they agree, because the view is what listings use.
 */
export function bundleMaxSellable(
  items: readonly { componentId: string; quantity: number }[],
  availability: ReadonlyMap<string, ComponentAvailability>,
): number {
  if (items.length === 0) return 0;
  return Math.min(
    ...items.map((item) => {
      const c = availability.get(item.componentId);
      return c && c.sellable ? Math.floor(c.available / item.quantity) : 0;
    }),
  );
}

export type StockLevel = "out" | "low" | "in";

export function stockLevel(available: number | null, lowStockThreshold: number): StockLevel {
  if (available === null) return "in"; // not stock-tracked (gift cards, digital)
  if (available <= 0) return "out";
  return available <= lowStockThreshold ? "low" : "in";
}

/** Most units of one product a shopper can put in a cart line at once (a sanity cap; checkout re-validates, M6). */
export const MAX_LINE_QUANTITY = 10;

/** How many units the quantity picker may offer: the stock on hand, capped; 0 when out of stock. null = not stock-tracked. */
export function purchasableLimit(available: number | null): number {
  if (available === null) return MAX_LINE_QUANTITY;
  return Math.max(0, Math.min(Math.floor(available), MAX_LINE_QUANTITY));
}

/** Clamps a requested quantity into 1..limit (0 when nothing can be bought). Non-finite input becomes 1. */
export function clampQuantity(requested: number, limit: number): number {
  if (limit <= 0) return 0;
  const n = Number.isFinite(requested) ? Math.floor(requested) : 1;
  return Math.min(Math.max(n, 1), limit);
}

export type ReservationStatus = "ACTIVE" | "CONVERTED" | "RELEASED" | "EXPIRED";

const RESOLVED: readonly ReservationStatus[] = ["CONVERTED", "RELEASED", "EXPIRED"];

/** ACTIVE can move to any resolved state; resolved states are final (the database enforces it too). */
export const canTransitionReservation = (from: ReservationStatus, to: ReservationStatus): boolean =>
  from === "ACTIVE" && RESOLVED.includes(to);

/** An ACTIVE reservation whose expiry has passed no longer holds stock (the availability view ignores it). */
export const holdsStock = (r: { status: ReservationStatus; expiresAt: Date }, now: Date): boolean =>
  r.status === "ACTIVE" && r.expiresAt.getTime() > now.getTime();
