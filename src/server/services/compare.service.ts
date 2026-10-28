import { isValidSlug } from "@/domain/catalog";
import {
  COMPARE_MAX,
  BUNDLE_GROUP,
  compareGroup,
  isComparableType,
  selectComparable,
  type CompareSection,
} from "@/domain/compare";
import { buildComparison, type CompareInput } from "@/domain/compare-table";
import { cardSavings } from "@/domain/listing";
import type { Bilingual } from "@/domain/product-page";
import {
  fetchBundlePartsMany,
  fetchCompareRows,
  type BundlePartsRow,
  type CompareRow,
} from "@/server/repositories/product.repository";
import {
  getCategory,
  getSpecDefinitions,
  getSpecOwnerResolver,
  type SpecOwnerResolver,
} from "./category.service";
import { toImage, type PageImage } from "./product.service";

export type CompareColumn = {
  slug: string;
  type: "PHYSICAL" | "BUNDLE";
  title: Bilingual;
  brand: Bilingual | null;
  image: PageImage | null;
  price: number;
  compareAtPrice: number | null;
  savings: ReturnType<typeof cardSavings>;
  available: number | null;
  lowStockThreshold: number;
};

export type ComparisonView = {
  columns: CompareColumn[];
  sections: CompareSection[];
  /** "bundles" or "parts" (one category); "empty" when nothing can be shown. */
  kind: "empty" | "parts" | "bundles";
  /** Name of the compared category (parts only). */
  categoryName: Bilingual | null;
  /** Slugs asked for that are not (or no longer) visible: removed, bad, hidden. */
  missing: string[];
  /** Products dropped because they belong to another category (or are of another kind). */
  dropped: number;
  /** More than four slugs were asked for. */
  truncated: boolean;
};

const empty = (missing: string[], truncated: boolean, dropped = 0): ComparisonView => ({
  columns: [],
  sections: [],
  kind: "empty",
  categoryName: null,
  missing,
  dropped,
  truncated,
});

const bi = (en: string | null, ar: string | null): Bilingual | null =>
  en ? { en, ar: ar ?? en } : null;

function toColumn(r: CompareRow): CompareColumn {
  const title = { en: r.titleEn, ar: r.titleAr };
  return {
    slug: r.slug,
    type: r.type as "PHYSICAL" | "BUNDLE",
    title,
    brand: bi(r.brandNameEn, r.brandNameAr),
    image: r.imageKey ? toImage(r.imageKey, r.imageAltEn, r.imageAltAr, title) : null,
    price: r.effectivePrice,
    compareAtPrice: r.compareAtPrice,
    savings: cardSavings({
      type: r.type,
      effectivePrice: r.effectivePrice,
      listTotal: r.listTotal,
      compareAtPrice: r.compareAtPrice,
    }),
    available: r.available,
    lowStockThreshold: r.lowStockThreshold,
  };
}

function toInput(
  r: CompareRow,
  parts: readonly BundlePartsRow[],
  owner: SpecOwnerResolver,
): CompareInput {
  const savings = cardSavings({
    type: r.type,
    effectivePrice: r.effectivePrice,
    listTotal: r.listTotal,
    compareAtPrice: r.compareAtPrice,
  });
  return {
    type: r.type as "PHYSICAL" | "BUNDLE",
    price: r.effectivePrice,
    savingsAmount: savings?.amount ?? null,
    available: r.available,
    lowStockThreshold: r.lowStockThreshold,
    brand: bi(r.brandNameEn, r.brandNameAr),
    modelName: r.modelName,
    condition: r.condition,
    warrantyMonths: r.warrantyMonths,
    specs: r.specs,
    parts: parts.map((p) => ({
      // Rows are per spec family (all CPUs on one row, whatever the brand sub-category).
      categoryPath: owner(p.categoryPath),
      title: { en: p.titleEn, ar: p.titleAr },
      quantity: p.quantity,
      specs: p.specs,
    })),
  };
}

/**
 * Everything the comparison page needs for the requested slugs, in the requested order. Statements: products (1),
 * bundle parts (1, only for bundles), spec definitions (cached), category names (cached tree). Bounded by
 * COMPARE_MAX; nothing per product. Hidden, deleted, draft or unknown slugs are reported as `missing`, never shown.
 */
export async function getComparison(slugs: readonly string[]): Promise<ComparisonView> {
  const wanted = [...new Set(slugs.filter(isValidSlug))];
  const truncated = wanted.length > COMPARE_MAX;
  const asked = wanted.slice(0, COMPARE_MAX);
  if (!process.env.DATABASE_URL || asked.length === 0) return empty([], truncated);

  const rows = await fetchCompareRows(asked);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const missing = asked.filter((s) => !bySlug.has(s));
  const ordered = asked
    .flatMap((s) => (bySlug.has(s) ? [bySlug.get(s) as CompareRow] : []))
    .filter((r) => isComparableType(r.type));
  const owner = await getSpecOwnerResolver();
  const withGroup = ordered.map((r) => ({
    slug: r.slug,
    group: compareGroup(r.type, owner(r.categoryPath)) ?? "",
    row: r,
  }));
  const { kept, dropped } = selectComparable(withGroup);
  if (kept.length === 0) return empty(missing, truncated, dropped.length);

  const kind = kept[0]?.group === BUNDLE_GROUP ? "bundles" : "parts";
  const keptRows = kept.map((k) => k.row);
  const firstPath = owner(keptRows[0]?.categoryPath ?? "");

  const [specDefs, partRows] = await Promise.all([
    kind === "parts" ? getSpecDefinitions(firstPath) : Promise.resolve([]),
    kind === "bundles"
      ? fetchBundlePartsMany(keptRows.map((r) => r.id))
      : Promise.resolve([] as BundlePartsRow[]),
  ]);

  const categoryNames: Record<string, Bilingual> = {};
  const paths = new Set(partRows.map((p) => owner(p.categoryPath)));
  if (kind === "parts") paths.add(firstPath);
  const found = await Promise.all(
    [...paths].map(async (path) => [path, await getCategory(path.split("/"))] as const),
  );
  for (const [path, category] of found) {
    const leaf = category?.chain[category.chain.length - 1];
    if (leaf) categoryNames[path] = { en: leaf.name.en, ar: leaf.name.ar };
  }

  const inputs = keptRows.map((r) =>
    toInput(
      r,
      partRows.filter((p) => p.bundleId === r.id),
      owner,
    ),
  );
  return {
    columns: keptRows.map(toColumn),
    sections: buildComparison(inputs, specDefs, categoryNames),
    kind,
    categoryName: kind === "parts" ? (categoryNames[firstPath] ?? null) : null,
    missing,
    dropped: dropped.length,
    truncated,
  };
}
