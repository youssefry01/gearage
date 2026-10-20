import type { SpecDef, SpecOption } from "@/domain/specs";

/** English + Arabic text. Arabic is machine-written and needs native review (docs/SEEDING.md, docs/I18N_REVIEW.md). */
export type Localized = { en: string; ar: string };

export type SpecValue = string | number | boolean | string[];
export type SpecValues = Record<string, SpecValue>;

export type SeedCategory = {
  /** Full path, parents first: "components/cpus/amd-ryzen". Slug, depth and parent derive from it. */
  path: string;
  name: Localized;
  description?: Localized;
  /** false = hidden until its feature ships (gift cards). Default true. */
  active?: boolean;
};

export type SeedBrand = { slug: string; name: string; website?: string };
export type SeedTag = { slug: string; name: Localized };

/** Category-specific spec definitions, keyed by the category that owns the family (children inherit, see resolveSpecDefinitions). */
export type SeedSpecs = Readonly<Record<string, readonly SpecDef[]>>;

export type ShowcaseSeed =
  | { type: "IMAGE"; alt: Localized; caption?: Localized }
  | { type: "IMAGE_TEXT"; alt: Localized; title: Localized; body: Localized; caption?: Localized }
  | { type: "FEATURE"; title: Localized; body: Localized }
  | { type: "VIDEO"; videoUrl: string; caption?: Localized };

export type SeedProduct = {
  /** Unique, upper-case. The identity the seed syncs on. */
  sku: string;
  brand: string;
  /** Category path the product lives in. */
  category: string;
  model: string;
  /** Manufacturer part number: ONLY where known with confidence. Barcodes (EAN) are never seeded. */
  mpn?: string;
  title: Localized;
  short: Localized;
  description?: Localized;
  /** ILLUSTRATIVE price in whole EGP (not a live market price). */
  priceEgp: number;
  compareAtEgp?: number;
  /** Illustrative unit cost in whole EGP. Default: 88% of the price. */
  costEgp?: number;
  warrantyMonths: number;
  /** Initial stock on hand (only applied when the product has no inventory row yet). 0 = tracked but out of stock. */
  stock: number;
  lowStockThreshold?: number;
  /** Initial counters (only applied on creation, so re-seeding never resets live numbers). */
  views: number;
  sold: number;
  /** Days before the seed epoch that the product was "added" (new-arrival ordering). */
  addedDaysAgo: number;
  tags: readonly string[];
  specs: SpecValues;
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  /** Specs the author is NOT sure about: listed in docs/SEEDING.md for verification against the manufacturer page. */
  verify?: { keys: readonly string[]; note: string };
  showcase?: readonly ShowcaseSeed[];
};

export type SeedBundleItem = { sku: string; quantity?: number };

export type SeedBundle = {
  sku: string;
  category: string;
  title: Localized;
  short: Localized;
  description: Localized;
  /** FIXED price in whole EGP (illustrative); must stay below the parts total (a test enforces it). */
  fixedPriceEgp: number;
  items: readonly SeedBundleItem[];
  warrantyMonths: number;
  views: number;
  sold: number;
  addedDaysAgo: number;
  tags: readonly string[];
  specs: SpecValues;
  showcase?: readonly ShowcaseSeed[];
};

export type { SpecDef, SpecOption };
