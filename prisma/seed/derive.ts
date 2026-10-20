import { slugify } from "@/domain/catalog";
import { fromPounds } from "@/domain/money";
import type { SeedBundle, SeedCategory, SeedProduct } from "./types";
import { DEFAULT_COST_RATIO } from "./data/helpers";

/** The seed's reference "now" for creation timestamps and expiry checks: fixed, so seeded dates are deterministic. */
export const SEED_EPOCH = new Date("2026-10-01T00:00:00.000Z");

export const createdAtFor = (addedDaysAgo: number): Date =>
  new Date(SEED_EPOCH.getTime() - addedDaysAgo * 86_400_000);

export const slugOfTitle = (titleEn: string): string => slugify(titleEn);
export const productSlug = (p: SeedProduct | SeedBundle): string => slugOfTitle(p.title.en);

export const priceOf = (p: SeedProduct): number => fromPounds(p.priceEgp);
export const compareAtOf = (p: SeedProduct): number | null =>
  p.compareAtEgp === undefined ? null : fromPounds(p.compareAtEgp);
export const costOf = (p: SeedProduct): number =>
  fromPounds(p.costEgp ?? Math.round(p.priceEgp * DEFAULT_COST_RATIO));

export const categorySlug = (c: Pick<SeedCategory, "path">): string =>
  c.path.split("/").at(-1) as string;
export const categoryDepth = (c: Pick<SeedCategory, "path">): number => c.path.split("/").length;
export const categoryParentPath = (c: Pick<SeedCategory, "path">): string | null =>
  c.path.includes("/") ? c.path.slice(0, c.path.lastIndexOf("/")) : null;

/** Storage keys for generated placeholders. All start with `seed/` so they are easy to tell from real uploads. */
export const keys = {
  product: (sku: string, n: number) => `seed/products/${sku.toLowerCase()}-${n}.svg`,
  category: (path: string) => `seed/categories/${path.replaceAll("/", "-")}.svg`,
  brand: (slug: string) => `seed/brands/${slug}.svg`,
  showcase: (sku: string, n: number) => `seed/showcase/${sku.toLowerCase()}-${n}.svg`,
};
