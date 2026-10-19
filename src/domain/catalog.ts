/** Catalog vocabulary and rules. Pure: mirrors the Prisma enums (a test keeps them in sync) without importing them. */
export const PRODUCT_TYPES = ["PHYSICAL", "BUNDLE", "GIFT_CARD", "DIGITAL"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** Same patterns as the database CHECK constraints, so a bad value fails in the app with a clear message first. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}

const MAX_SLUG_LENGTH = 80;

/** URL slug from an ENGLISH title: ASCII, lowercase, hyphen separated. Arabic titles are not slugged. */
export function slugify(text: string): string {
  const ascii = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!ascii)
    throw new CatalogError(`cannot make a slug from "${text}" (no latin letters or digits)`);
  if (ascii.length <= MAX_SLUG_LENGTH) return ascii;
  const cut = ascii.slice(0, MAX_SLUG_LENGTH);
  return cut.slice(0, cut.lastIndexOf("-") > 20 ? cut.lastIndexOf("-") : MAX_SLUG_LENGTH);
}

export const isValidSlug = (slug: string): boolean => SLUG_PATTERN.test(slug);

/** SKUs are stored upper-case; spaces become hyphens. Throws if the result is not a valid SKU. */
export function normalizeSku(raw: string): string {
  const sku = raw.trim().toUpperCase().replace(/\s+/g, "-");
  if (!SKU_PATTERN.test(sku)) throw new CatalogError(`invalid SKU "${raw}"`);
  return sku;
}

/** GS1 check digit for EAN-8, UPC-A (12), EAN-13 and GTIN-14. */
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop() as number;
  const total = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (total % 10)) % 10 === check;
}

const TRANSITIONS: Record<ProductStatus, readonly ProductStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["DRAFT", "ARCHIVED"],
  ARCHIVED: ["DRAFT", "ACTIVE"],
};
export const canTransitionStatus = (from: ProductStatus, to: ProductStatus): boolean =>
  TRANSITIONS[from].includes(to);

/** Visible on the storefront: ACTIVE and not soft-deleted. (Whether it is in stock is a separate question.) */
export const isPubliclyVisible = (p: { status: ProductStatus; deletedAt: Date | null }): boolean =>
  p.status === "ACTIVE" && p.deletedAt === null;

export type ActivationProblem = "MISSING_PRICE" | "MISSING_TITLE" | "BUNDLE_NEEDS_COMPONENTS";

/** What must be true before a product can go ACTIVE. Empty array = good to publish. */
export function activationProblems(p: {
  type: ProductType;
  price: number | null;
  titleEn: string;
  titleAr: string;
  bundleComponentCount?: number;
  derivedPrice?: boolean;
}): ActivationProblem[] {
  const problems: ActivationProblem[] = [];
  if (!p.titleEn.trim() || !p.titleAr.trim()) problems.push("MISSING_TITLE");
  if (p.price === null && !p.derivedPrice) problems.push("MISSING_PRICE");
  if (p.type === "BUNDLE" && (p.bundleComponentCount ?? 0) < 2)
    problems.push("BUNDLE_NEEDS_COMPONENTS");
  return problems;
}
