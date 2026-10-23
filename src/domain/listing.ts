import { SLUG_PATTERN } from "@/domain/catalog";
import { fromPounds } from "@/domain/money";
import type { SpecDef } from "@/domain/specs";

/**
 * Listing filters as they travel in the URL (ADR 0016). Pure: parsing, normalization, the canonical query string and
 * the SEO policy live here so they can be tested without a database or a browser.
 *
 * URL grammar (all optional; unknown or invalid parameters are ignored, never an error):
 *   brand=<slug>            repeatable      tag=<slug>              repeatable
 *   price_min / price_max   whole EGP       in_stock=1              sale=1
 *   spec.<key>=<value>      repeatable, for CHECKBOX specs (ENUM / STRING / STRING_LIST)
 *   spec.<key>=<lo>..<hi>   either side optional, for RANGE specs
 *   spec.<key>=1            for TOGGLE specs
 *   sort=<sort>             page=<n>
 */
export const SORTS = [
  "popular",
  "best-selling",
  "newest",
  "price-asc",
  "price-desc",
  "discount",
] as const;
export type Sort = (typeof SORTS)[number];
export const DEFAULT_SORT: Sort = "popular";

export const PAGE_SIZE = 24;
export const MAX_PAGE = 1000;
const MAX_VALUES = 20;
const MAX_VALUE_LENGTH = 100;
const MAX_PRICE_POUNDS = 20_000_000;

export type SpecSelection = {
  /** CHECKBOX: any-of. */
  values?: string[];
  /** RANGE bounds (inclusive), in the spec's own unit. */
  min?: number;
  max?: number;
  /** TOGGLE: only products where the spec is true. */
  on?: true;
};

export type ListingFilters = {
  brands: string[];
  tags: string[];
  /** Piastres. */
  priceMin?: number;
  priceMax?: number;
  inStock: boolean;
  onSale: boolean;
  /** Keyed by SpecDef.key. */
  specs: Record<string, SpecSelection>;
  sort: Sort;
  page: number;
};

export type RawParams = Readonly<Record<string, string | string[] | undefined>>;

const all = (raw: RawParams, name: string): string[] => {
  const v = raw[name];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
};
const first = (raw: RawParams, name: string): string | undefined => all(raw, name)[0];

const uniqueSorted = (values: readonly string[]): string[] =>
  [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

function slugList(raw: RawParams, name: string): string[] {
  return uniqueSorted(
    all(raw, name).filter((s) => s.length <= MAX_VALUE_LENGTH && SLUG_PATTERN.test(s)),
  ).slice(0, MAX_VALUES);
}

/** Whole, non-negative EGP amount from a URL value, or undefined. */
function poundsParam(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d{1,8}$/.test(value)) return undefined;
  const pounds = Number(value);
  if (pounds > MAX_PRICE_POUNDS) return undefined;
  return fromPounds(pounds);
}

const NUMBER = /^-?\d+(\.\d+)?$/;
const numberOrUndefined = (s: string): number | undefined =>
  s !== "" && NUMBER.test(s) && Number.isFinite(Number(s)) ? Number(s) : undefined;

/** "8..16", "8..", "..16" (or a single "8" meaning exactly 8). Returns undefined when nothing usable. */
export function parseRange(value: string): { min?: number; max?: number } | undefined {
  const parts = value.split("..");
  if (parts.length === 1) {
    const exact = numberOrUndefined(value);
    return exact === undefined ? undefined : { min: exact, max: exact };
  }
  if (parts.length !== 2) return undefined;
  const loText = parts[0] ?? "";
  const hiText = parts[1] ?? "";
  const lo = numberOrUndefined(loText);
  const hi = numberOrUndefined(hiText);
  // A side that is present but not a number invalidates the whole range (never a silent half-range).
  if ((loText !== "" && lo === undefined) || (hiText !== "" && hi === undefined)) return undefined;
  if (lo === undefined && hi === undefined) return undefined;
  if (lo !== undefined && hi !== undefined && lo > hi) return { min: hi, max: lo };
  return { ...(lo === undefined ? {} : { min: lo }), ...(hi === undefined ? {} : { max: hi }) };
}

/** The spec definitions that may be filtered on the listing page (the category's SpecDefinition filter config). */
export const listingFacets = (defs: readonly SpecDef[]): SpecDef[] =>
  defs.filter((d) => d.filterable && d.facet !== "NONE");

function parseSpec(def: SpecDef, rawValues: string[]): SpecSelection | undefined {
  switch (def.facet) {
    case "CHECKBOX": {
      const allowed = def.options ? new Set(def.options.map((o) => o.value)) : undefined;
      const values = uniqueSorted(
        rawValues.filter(
          (v) => v.length > 0 && v.length <= MAX_VALUE_LENGTH && (!allowed || allowed.has(v)),
        ),
      ).slice(0, MAX_VALUES);
      return values.length > 0 ? { values } : undefined;
    }
    case "RANGE": {
      const range = rawValues.map(parseRange).find((r) => r !== undefined);
      return range;
    }
    case "TOGGLE":
      return rawValues.includes("1") ? { on: true } : undefined;
    default:
      return undefined;
  }
}

/**
 * Turns raw URL parameters into validated filters. `defs` is the category's spec definitions: only filterable ones
 * are honoured, and ENUM values must be real options. Anything else is dropped silently, so a stale bookmark or a
 * tracking parameter never breaks a page (the canonical URL, see listingSeo, shows the cleaned form).
 */
export function parseListingParams(raw: RawParams, defs: readonly SpecDef[] = []): ListingFilters {
  const facets = new Map(listingFacets(defs).map((d) => [d.key, d]));
  const specs: Record<string, SpecSelection> = {};
  for (const name of Object.keys(raw)) {
    if (!name.startsWith("spec.")) continue;
    const def = facets.get(name.slice(5));
    if (!def) continue;
    const selection = parseSpec(def, all(raw, name));
    if (selection) specs[def.key] = selection;
  }

  let priceMin = poundsParam(first(raw, "price_min"));
  let priceMax = poundsParam(first(raw, "price_max"));
  if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax)
    [priceMin, priceMax] = [priceMax, priceMin];

  const sortRaw = first(raw, "sort");
  const sort = (SORTS as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as Sort)
    : DEFAULT_SORT;
  const pageRaw = first(raw, "page");
  const page =
    pageRaw !== undefined && /^\d{1,4}$/.test(pageRaw)
      ? Math.min(Math.max(Number(pageRaw), 1), MAX_PAGE)
      : 1;

  return {
    brands: slugList(raw, "brand"),
    tags: slugList(raw, "tag"),
    ...(priceMin === undefined ? {} : { priceMin }),
    ...(priceMax === undefined ? {} : { priceMax }),
    inStock: first(raw, "in_stock") === "1",
    onSale: first(raw, "sale") === "1",
    specs,
    sort,
    page,
  };
}

const POUND = 100;
const rangeText = (s: SpecSelection): string =>
  `${s.min === undefined ? "" : s.min}..${s.max === undefined ? "" : s.max}`;

/**
 * Canonical query string: fixed parameter order, sorted values, defaults omitted (page 1, default sort). Two URLs
 * that mean the same thing serialize identically. Returns "" or a string starting with "?".
 */
export function listingQuery(filters: ListingFilters, options: { page?: boolean } = {}): string {
  const p = new URLSearchParams();
  for (const b of filters.brands) p.append("brand", b);
  for (const t of filters.tags) p.append("tag", t);
  if (filters.priceMin !== undefined) p.set("price_min", String(filters.priceMin / POUND));
  if (filters.priceMax !== undefined) p.set("price_max", String(filters.priceMax / POUND));
  if (filters.inStock) p.set("in_stock", "1");
  if (filters.onSale) p.set("sale", "1");
  for (const key of Object.keys(filters.specs).sort()) {
    const s = filters.specs[key] as SpecSelection;
    if (s.values) for (const v of s.values) p.append(`spec.${key}`, v);
    else if (s.on) p.set(`spec.${key}`, "1");
    else if (s.min !== undefined || s.max !== undefined) p.set(`spec.${key}`, rangeText(s));
  }
  if (filters.sort !== DEFAULT_SORT) p.set("sort", filters.sort);
  if (options.page !== false && filters.page > 1) p.set("page", String(filters.page));
  const text = p.toString();
  return text ? `?${text}` : "";
}

/** Number of active facet selections (what the "Filters (3)" badge shows). Sort and page are not filters. */
export function activeFilterCount(filters: ListingFilters): number {
  return (
    filters.brands.length +
    filters.tags.length +
    (filters.priceMin !== undefined || filters.priceMax !== undefined ? 1 : 0) +
    (filters.inStock ? 1 : 0) +
    (filters.onSale ? 1 : 0) +
    Object.values(filters.specs).reduce((n, s) => n + (s.values ? s.values.length : 1), 0)
  );
}

export const hasActiveFilters = (filters: ListingFilters): boolean =>
  activeFilterCount(filters) > 0;

/**
 * Index policy for a listing URL (ADR 0016):
 *  - clean category URL and plain pagination (`?page=N`): indexable, self-canonical, hreflang for every locale;
 *  - any filter or non-default sort: `noindex, follow`, canonical = its own normalized URL, NO hreflang (a noindex
 *    page does not belong in a hreflang cluster), never in the sitemap.
 * Tracking and unknown parameters are simply absent from the normalized form, so they canonicalize away.
 */
export type ListingSeo = {
  indexable: boolean;
  /** Normalized query (with page) for the canonical URL: "" or "?...". */
  canonicalQuery: string;
  /** Emit hreflang alternates (indexable URLs only). */
  hreflang: boolean;
  /** Pagination links on this page should carry rel="nofollow" (crawl budget on filtered sets). */
  nofollowPagination: boolean;
};

export function listingSeo(filters: ListingFilters): ListingSeo {
  const refined = hasActiveFilters(filters) || filters.sort !== DEFAULT_SORT;
  return {
    indexable: !refined,
    canonicalQuery: listingQuery(filters),
    hreflang: !refined,
    nofollowPagination: refined,
  };
}

export const totalPages = (total: number, pageSize = PAGE_SIZE): number =>
  Math.max(1, Math.ceil(total / pageSize));

/**
 * Page numbers to render: always first and last, a window around the current page, and `null` for each gap
 * (rendered as an ellipsis). Example: current 7 of 20 -> [1, null, 5, 6, 7, 8, 9, null, 20].
 */
export function pageWindow(current: number, last: number, radius = 2): (number | null)[] {
  const pages = new Set<number>([1, last]);
  for (let n = current - radius; n <= current + radius; n++) if (n >= 1 && n <= last) pages.add(n);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && n - prev === 2) out.push(prev + 1);
    else if (prev !== undefined && n - prev > 2) out.push(null);
    out.push(n);
  });
  return out;
}

/** TypeScript twin of the SQL spec predicate (parity-tested against the database). */
export function specsMatch(
  productSpecs: Readonly<Record<string, unknown>>,
  selections: Readonly<Record<string, SpecSelection>>,
): boolean {
  return Object.entries(selections).every(([key, sel]) => {
    const value = productSpecs[key];
    if (sel.values) {
      if (Array.isArray(value)) return value.some((v) => sel.values?.includes(String(v)));
      return value !== undefined && value !== null && sel.values.includes(String(value));
    }
    if (sel.on) return value === true;
    if (typeof value !== "number") return false;
    return (
      (sel.min === undefined || value >= sel.min) && (sel.max === undefined || value <= sel.max)
    );
  });
}

/** Savings shown on a card, and the base it is measured against (compare-at price, or the parts total for bundles). */
export type CardSavings = { amount: number; percent: number; kind: "compare-at" | "bundle" };

export function cardSavings(p: {
  type: string;
  effectivePrice: number;
  listTotal: number;
  compareAtPrice: number | null;
}): CardSavings | null {
  const base = p.type === "BUNDLE" ? p.listTotal : p.compareAtPrice;
  if (base === null || base <= p.effectivePrice) return null;
  const amount = base - p.effectivePrice;
  return {
    amount,
    percent: Math.round((amount * 100) / base),
    kind: p.type === "BUNDLE" ? "bundle" : "compare-at",
  };
}

/** One removable selection (a chip above the results). */
export type Selection =
  | { type: "brand" | "tag"; value: string }
  | { type: "price" | "in_stock" | "sale" }
  | { type: "spec"; key: string; value?: string };

/** Filters with one selection removed. Any change of filters returns to page 1. */
export function withoutSelection(f: ListingFilters, s: Selection): ListingFilters {
  const next: ListingFilters = { ...f, specs: { ...f.specs }, page: 1 };
  switch (s.type) {
    case "brand":
      next.brands = f.brands.filter((b) => b !== s.value);
      break;
    case "tag":
      next.tags = f.tags.filter((t) => t !== s.value);
      break;
    case "price":
      delete next.priceMin;
      delete next.priceMax;
      break;
    case "in_stock":
      next.inStock = false;
      break;
    case "sale":
      next.onSale = false;
      break;
    case "spec": {
      const current = f.specs[s.key];
      const remaining = current?.values?.filter((v) => v !== s.value) ?? [];
      if (s.value !== undefined && remaining.length > 0) next.specs[s.key] = { values: remaining };
      else delete next.specs[s.key];
      break;
    }
  }
  return next;
}

export const withSort = (f: ListingFilters, sort: Sort): ListingFilters => ({
  ...f,
  sort,
  page: 1,
});
export const withPage = (f: ListingFilters, page: number): ListingFilters => ({ ...f, page });

/** Drops every facet selection but keeps the chosen sort. */
export const clearedFilters = (f: ListingFilters): ListingFilters => ({
  brands: [],
  tags: [],
  inStock: false,
  onSale: false,
  specs: {},
  sort: f.sort,
  page: 1,
});
