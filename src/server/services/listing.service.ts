import {
  type ListingFilters,
  PAGE_SIZE,
  listingFacets,
  parseListingParams,
  totalPages,
  type RawParams,
} from "@/domain/listing";
import type { SpecDef } from "@/domain/specs";
import {
  type FacetCounts,
  type ListingResult,
  type ListingRow,
  fetchBrandNames,
  fetchTagNames,
  queryListing,
} from "@/server/repositories/listing.repository";
import { publicImageUrl } from "@/server/storage/public-url";
import { compareGroup } from "@/domain/compare";
import {
  getSpecDefinitions,
  getSpecOwnerResolver,
  type SpecOwnerResolver,
} from "./category.service";

export type Bilingual = { en: string; ar: string };

/** What a product card needs. Prices are integer piastres; names are both locales (the UI picks one). */
export type ProductCardData = {
  id: string;
  type: ListingRow["type"];
  slug: string;
  categoryPath: string;
  /** What the product may be compared with ("bundle", or its spec family); null = cannot be compared. */
  compareGroup: string | null;
  title: Bilingual;
  brand: { slug: string; name: Bilingual } | null;
  effectivePrice: number;
  listTotal: number;
  compareAtPrice: number | null;
  available: number | null;
  lowStockThreshold: number;
  image: { url: string; alt: Bilingual } | null;
  componentCount: number;
};

export function toCardData(row: ListingRow, owner: SpecOwnerResolver): ProductCardData {
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    categoryPath: row.categoryPath,
    compareGroup: compareGroup(row.type, owner(row.categoryPath)),
    title: { en: row.titleEn, ar: row.titleAr },
    brand: row.brandSlug
      ? {
          slug: row.brandSlug,
          name: {
            en: row.brandNameEn ?? row.brandSlug,
            ar: row.brandNameAr ?? row.brandNameEn ?? row.brandSlug,
          },
        }
      : null,
    effectivePrice: row.effectivePrice,
    listTotal: row.listTotal,
    compareAtPrice: row.compareAtPrice,
    available: row.available,
    lowStockThreshold: row.lowStockThreshold,
    image: row.imageKey
      ? {
          url: publicImageUrl(row.imageKey),
          alt: { en: row.imageAltEn ?? row.titleEn, ar: row.imageAltAr ?? row.titleAr },
        }
      : null,
    componentCount: row.componentCount,
  };
}

export type FacetOption = { value: string; label: Bilingual; count: number; selected: boolean };

export type SpecFacet =
  | { kind: "checkbox"; key: string; label: Bilingual; unit: string | null; options: FacetOption[] }
  | {
      kind: "range";
      key: string;
      label: Bilingual;
      unit: string | null;
      bounds: { min: number; max: number } | null;
    }
  | { kind: "toggle"; key: string; label: Bilingual; count: number };

export type ListingView = {
  filters: ListingFilters;
  /** The category's filterable specs (validates what the filter form submits). */
  specDefs: SpecDef[];
  items: ProductCardData[];
  total: number;
  pages: number;
  pageSize: number;
  brandOptions: FacetOption[];
  tagOptions: FacetOption[];
  specFacets: SpecFacet[];
  priceBounds: { min: number; max: number } | null;
  inStockCount: number;
  onSaleCount: number;
};

/** Options with a count (or already selected, so the user can always un-pick), most products first. */
function toOptions(
  counts: Readonly<Record<string, number>>,
  selected: readonly string[],
  labels: ReadonlyMap<string, Bilingual>,
): FacetOption[] {
  const values = new Set([...Object.keys(counts), ...selected]);
  return [...values]
    .map((value) => ({
      value,
      label: labels.get(value) ?? { en: value, ar: value },
      count: counts[value] ?? 0,
      selected: selected.includes(value),
    }))
    .filter((o) => o.count > 0 || o.selected)
    .sort((a, b) => b.count - a.count || a.label.en.localeCompare(b.label.en));
}

function buildSpecFacets(
  defs: readonly SpecDef[],
  counts: FacetCounts["specs"],
  filters: ListingFilters,
): SpecFacet[] {
  const out: SpecFacet[] = [];
  for (const def of listingFacets(defs)) {
    const label = { en: def.labelEn, ar: def.labelAr };
    const entry = counts[def.key];
    if (def.facet === "CHECKBOX") {
      const optionLabels = new Map<string, Bilingual>(
        (def.options ?? []).map((o) => [o.value, { en: o.labelEn, ar: o.labelAr }]),
      );
      const options = toOptions(
        entry && "counts" in entry ? entry.counts : {},
        filters.specs[def.key]?.values ?? [],
        optionLabels,
      );
      if (options.length > 0)
        out.push({ kind: "checkbox", key: def.key, label, unit: def.unit ?? null, options });
    } else if (def.facet === "RANGE") {
      const bounds = entry && "min" in entry ? entry : null;
      const active = filters.specs[def.key] !== undefined;
      if (bounds || active)
        out.push({ kind: "range", key: def.key, label, unit: def.unit ?? null, bounds });
    } else if (def.facet === "TOGGLE") {
      const count = entry && "count" in entry ? entry.count : 0;
      if (count > 0 || filters.specs[def.key])
        out.push({ kind: "toggle", key: def.key, label, count });
    }
  }
  return out;
}

/**
 * Everything a listing page shows, from filters and a query result: names for the facet options (two small lookups,
 * never per option) and the shaped facets. Shared by category pages and the search results page.
 */
export async function assembleListingView(
  filters: ListingFilters,
  specDefs: readonly SpecDef[],
  result: ListingResult,
  pageSize: number,
): Promise<ListingView> {
  const brandSlugs = [...new Set([...Object.keys(result.facets.brands), ...filters.brands])];
  const tagSlugs = [...new Set([...Object.keys(result.facets.tags), ...filters.tags])];
  const [brands, tags, owner] = await Promise.all([
    fetchBrandNames(brandSlugs),
    fetchTagNames(tagSlugs),
    getSpecOwnerResolver(),
  ]);
  const brandLabels = new Map(
    brands.map((b) => [b.slug, { en: b.nameEn, ar: b.nameAr ?? b.nameEn }] as const),
  );
  const tagLabels = new Map(tags.map((t) => [t.slug, { en: t.nameEn, ar: t.nameAr }] as const));

  return {
    filters,
    specDefs: listingFacets(specDefs),
    items: result.rows.map((r) => toCardData(r, owner)),
    total: result.total,
    pages: totalPages(result.total, pageSize),
    pageSize,
    brandOptions: toOptions(result.facets.brands, filters.brands, brandLabels),
    tagOptions: toOptions(result.facets.tags, filters.tags, tagLabels),
    specFacets: buildSpecFacets(specDefs, result.facets.specs, filters),
    priceBounds: result.facets.price,
    inStockCount: result.facets.inStock,
    onSaleCount: result.facets.onSale,
  };
}

/**
 * The category listing page's data: parse the URL, run the three listing statements, shape the view.
 * `categoryPath` undefined = the whole catalog.
 */
export async function getListing(
  categoryPath: string | undefined,
  raw: RawParams,
  pageSize: number = PAGE_SIZE,
): Promise<ListingView> {
  const specDefs = categoryPath ? await getSpecDefinitions(categoryPath) : [];
  const filters = parseListingParams(raw, specDefs);
  const result = await queryListing({
    ...(categoryPath ? { categoryPath } : {}),
    filters,
    specDefs,
    pageSize,
  });
  return assembleListingView(filters, specDefs, result, pageSize);
}
