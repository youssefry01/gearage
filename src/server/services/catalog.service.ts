import {
  analyzeBuild,
  roleOfCategoryPath,
  type BuildPart,
  type CompatibilityReport,
} from "@/domain/compatibility";
import {
  bundleMargin,
  quoteBundle,
  type BundleComponent,
  type BundlePricing,
  type BundleQuote,
  type Margin,
} from "@/domain/pricing";
import { AppError } from "@/lib/errors";
import { getDb } from "@/server/db";
import {
  fetchAvailability,
  fetchBundleComponents,
  listStorefront,
  type BundleComponentRow,
  type StorefrontQuery,
  type StorefrontRow,
} from "@/server/repositories/catalog.repository";

export type { StorefrontRow };

/** Units available per product (null = not stock-tracked). */
export const getAvailability = (productIds: readonly string[]) => fetchAvailability(productIds);

export type BundleDetail = {
  id: string;
  slug: string;
  titleEn: string;
  titleAr: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  components: (BundleComponentRow & { unitPrice: number })[];
  quote: BundleQuote;
  /** How many whole bundles can be sold right now (derived from the components). */
  available: number;
  compatibility: CompatibilityReport;
  /** Only present when requested (admin): margin needs component costs. */
  margin?: Margin;
};

/**
 * Everything a bundle page needs, in three queries total (bundle row, components with availability, bundle
 * availability): component table, derived price and "you save", derived stock, and the compatibility badge.
 */
export async function getBundleDetail(
  bundleId: string,
  options: { includeMargin?: boolean } = {},
): Promise<BundleDetail> {
  const db = getDb();
  const bundle = await db.product.findFirst({
    where: { id: bundleId, type: "BUNDLE", deletedAt: null },
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleAr: true,
      status: true,
      price: true,
      bundlePricingMode: true,
      bundleDiscountBps: true,
      bundleDiscountAmount: true,
    },
  });
  if (!bundle || !bundle.bundlePricingMode) throw new AppError("NOT_FOUND", "Bundle not found");

  const [rows, availability] = await Promise.all([
    fetchBundleComponents(bundleId, db),
    fetchAvailability([bundleId], db),
  ]);
  const components = rows.map((r) => ({ ...r, unitPrice: r.price }));

  const pricing: BundlePricing =
    bundle.bundlePricingMode === "FIXED"
      ? { mode: "FIXED", price: bundle.price ?? 0 }
      : bundle.bundlePricingMode === "DISCOUNT_PERCENT"
        ? { mode: "DISCOUNT_PERCENT", bps: bundle.bundleDiscountBps ?? 0 }
        : { mode: "DISCOUNT_FIXED", amount: bundle.bundleDiscountAmount ?? 0 };
  const priced: BundleComponent[] = rows.map((r) => ({
    productId: r.componentId,
    quantity: r.quantity,
    unitPrice: r.price,
    unitCost: r.cost,
  }));
  const quote = quoteBundle(pricing, priced);

  const parts: BuildPart[] = rows.flatMap((r) => {
    const role = roleOfCategoryPath(r.categoryPath);
    return role ? [{ role, quantity: r.quantity, specs: r.specs }] : [];
  });

  return {
    id: bundle.id,
    slug: bundle.slug,
    titleEn: bundle.titleEn,
    titleAr: bundle.titleAr,
    status: bundle.status,
    components,
    quote,
    available: availability.get(bundleId) ?? 0,
    compatibility: analyzeBuild(parts),
    ...(options.includeMargin ? { margin: bundleMargin(quote.price, priced) } : {}),
  };
}

/** Storefront listing (physical products and bundles together) in one query. */
export function listStorefrontProducts(
  query: Partial<StorefrontQuery> = {},
): Promise<StorefrontRow[]> {
  const limit = Math.min(Math.max(query.limit ?? 24, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);
  return listStorefront({ ...query, limit, offset });
}
