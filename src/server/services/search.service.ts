import { type CategoryNode, findCategory } from "@/domain/category-tree";
import {
  type ListingFilters,
  PAGE_SIZE,
  type RawParams,
  activeFilterCount,
  parseListingParams,
} from "@/domain/listing";
import {
  type ParsedQuery,
  applyCorrections,
  correctableTokens,
  isLoggableSearchTerm,
  isSearchable,
  parseSearchQuery,
  phrasePatterns,
  pickCorrection,
  termsMatchText,
  SYNONYM_WORDS,
  toPartialTsQueryTexts,
  toTsQueryText,
} from "@/domain/search";
import type { SpecDef } from "@/domain/specs";
import { ttlCache } from "@/server/cache/ttl";
import {
  type ListingQuery,
  type ListingResult,
  type SearchMatch,
  queryListing,
} from "@/server/repositories/listing.repository";
import {
  fetchSearchableBrands,
  lookupVocabulary,
  pruneZeroResults,
  rebuildSearchIndex,
  recordZeroResult,
} from "@/server/repositories/search.repository";
import { getCategory, getCategoryTree, getSpecDefinitions } from "./category.service";
import {
  type Bilingual,
  type ListingView,
  type ProductCardData,
  assembleListingView,
  toCardData,
} from "./listing.service";

/**
 * How a search was satisfied (ADR 0019):
 *  exact      every word matched (including synonyms, prefixes, letter/digit splits);
 *  corrected  nothing matched, so misspelled words were replaced by the closest catalog words and that matched;
 *  partial    still nothing, so products matching at least one word are shown;
 *  none       nothing at all;
 *  browse     no search term (the all-products, deals, best-sellers views).
 */
export type SearchTier = "browse" | "exact" | "corrected" | "partial" | "none";

export type SearchCategoryOption = { path: string; name: Bilingual; count: number };

export type SearchView = ListingView & {
  query: string | undefined;
  tier: SearchTier;
  /** The wording that was actually searched when tier is "corrected" (what "Showing results for" displays). */
  correctedQuery: string | null;
  /** The term is too short to search (fewer than two characters once normalized). */
  tooShort: boolean;
  /** Sub-categories of the selected category (top-level categories when none is selected), with counts. */
  categoryOptions: SearchCategoryOption[];
  /** The selected category and its ancestors, outermost first (for "All > Components > CPUs"). */
  categoryTrail: { path: string; name: Bilingual }[];
  /** Normalized term to store for zero-result analytics, or null when this search must not be stored. */
  zeroResultTerm: string | null;
};

const buildMatch = (parsed: ParsedQuery): SearchMatch => {
  const tsQuery = toTsQueryText(parsed, "all");
  if (tsQuery === null) throw new Error("buildMatch needs a searchable query");
  return { tsQuery, phrasePatterns: phrasePatterns(parsed) };
};

/** null when the query has no word to relax on (only model numbers). */
const buildPartialMatch = (parsed: ParsedQuery): SearchMatch | null => {
  const texts = toPartialTsQueryTexts(parsed);
  return texts
    ? {
        tsQuery: texts.match,
        rankTsQuery: texts.rank,
        termTsQueries: texts.terms,
        phrasePatterns: phrasePatterns(parsed),
      }
    : null;
};

/** Replaces misspelled words by the closest catalog words; null when nothing needs or can be corrected. */
async function correctQuery(parsed: ParsedQuery): Promise<ParsedQuery | null> {
  const lookups = await lookupVocabulary(correctableTokens(parsed));
  const corrections = new Map<string, string>();
  for (const l of lookups) {
    if (l.known) continue;
    const pick = pickCorrection(l.token, [...l.candidates, ...SYNONYM_WORDS]);
    if (pick !== undefined) corrections.set(l.token, pick);
  }
  return corrections.size === 0 ? null : parseSearchQuery(applyCorrections(parsed, corrections));
}

type Tiered = {
  tier: Exclude<SearchTier, "browse">;
  result: ListingResult;
  effective: ParsedQuery;
};

/**
 * Exact, then corrected, then partial: each later step only runs when the one before found nothing, and only when no
 * filter is active (a filter that empties the results is not a spelling problem; the page offers to clear it).
 * Typical cost: one search (3 statements); a miss adds one vocabulary lookup and one or two more searches.
 */
async function searchTiered(
  parsed: ParsedQuery,
  query: (match: SearchMatch) => ListingQuery,
  allowFallback: boolean,
): Promise<Tiered> {
  let result = await queryListing(query(buildMatch(parsed)));
  if (result.total > 0) return { tier: "exact", result, effective: parsed };
  if (!allowFallback) return { tier: "none", result, effective: parsed };

  let effective = parsed;
  const corrected = await correctQuery(parsed);
  if (corrected && isSearchable(corrected)) {
    effective = corrected;
    result = await queryListing(query(buildMatch(effective)));
    if (result.total > 0) return { tier: "corrected", result, effective };
  }
  const partial = effective.terms.length >= 2 ? buildPartialMatch(effective) : null;
  if (partial) {
    result = await queryListing(query(partial));
    if (result.total > 0) return { tier: "partial", result, effective };
  }
  return { tier: "none", result, effective: parsed };
}

const emptyResult = (): ListingResult => ({
  rows: [],
  total: 0,
  facets: {
    categories: {},
    brands: {},
    tags: {},
    price: null,
    inStock: 0,
    onSale: 0,
    specs: {},
  },
});

function nodeAt(tree: readonly CategoryNode[], path: string): CategoryNode | undefined {
  return findCategory(tree, path.split("/"))?.node;
}

/**
 * The search results page's data. The URL grammar is the listing grammar plus `q` and `category`; with no `q` it is the
 * all-products view (so "deals", "best sellers" and "new arrivals" are just sorted/filtered views of this page).
 */
export async function getSearchView(
  raw: RawParams,
  pageSize: number = PAGE_SIZE,
): Promise<SearchView> {
  const tree = await getCategoryTree();
  const first = parseListingParams(raw, [], { search: true });
  const found = first.category ? await getCategory(first.category.split("/")) : undefined;
  const specDefs: readonly SpecDef[] = found ? await getSpecDefinitions(found.node.path) : [];
  const parsedFilters = parseListingParams(raw, specDefs, { search: true });
  // A category that does not exist (or is hidden) is dropped like any invalid parameter.
  const { category: _dropped, ...withoutCategory } = parsedFilters;
  const filters: ListingFilters = found
    ? { ...withoutCategory, category: found.node.path }
    : withoutCategory;

  const base = {
    ...(found ? { categoryPath: found.node.path } : {}),
    filters,
    specDefs,
    pageSize,
    withCategoryFacet: true,
  } satisfies ListingQuery;
  const allowFallback = activeFilterCount(filters) === 0;

  let tier: SearchTier = "browse";
  let result: ListingResult;
  let effective: ParsedQuery | undefined;
  let tooShort = false;
  const parsed = filters.q ? parseSearchQuery(filters.q) : undefined;

  if (!parsed) {
    result = await queryListing(base);
  } else if (!isSearchable(parsed)) {
    tooShort = true;
    tier = "none";
    result = emptyResult();
  } else {
    const tiered = await searchTiered(parsed, (search) => ({ ...base, search }), allowFallback);
    ({ tier, result, effective } = tiered);
  }

  const view = await assembleListingView(filters, specDefs, result, pageSize);
  const categoryOptions = Object.entries(result.facets.categories)
    .flatMap(([path, count]) => {
      const node = nodeAt(tree, path);
      return node ? [{ path, name: node.name, count }] : [];
    })
    .sort((a, b) => b.count - a.count || a.name.en.localeCompare(b.name.en));

  return {
    ...view,
    query: filters.q,
    tier,
    correctedQuery:
      tier === "corrected" && effective ? effective.input || effective.normalized : null,
    tooShort,
    categoryOptions,
    categoryTrail: (found?.chain ?? []).map((n) => ({ path: n.path, name: n.name })),
    zeroResultTerm:
      tier === "none" &&
      parsed &&
      allowFallback &&
      !tooShort &&
      isLoggableSearchTerm(parsed.input, parsed.normalized)
        ? parsed.normalized
        : null,
  };
}

/** Stores a zero-result search for analytics (fire and forget: never let analytics break or slow a search). */
export async function logZeroResult(term: string, now: Date = new Date()): Promise<void> {
  try {
    await recordZeroResult(term, now);
  } catch {
    // Analytics only; the shopper's search already succeeded.
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Suggestions (the header search dropdown)
// ---------------------------------------------------------------------------------------------------------------

export type SuggestionProduct = Pick<
  ProductCardData,
  "id" | "slug" | "title" | "effectivePrice" | "available" | "image" | "type"
> & { brandName: Bilingual | null };

export type Suggestions = {
  query: string;
  /** The corrected wording when the typed one found nothing. */
  corrected: string | null;
  products: SuggestionProduct[];
  categories: { path: string; name: Bilingual }[];
  brands: { slug: string; name: Bilingual }[];
  /** Matching products in total (the "see all N results" link). */
  total: number;
};

const SUGGEST_PRODUCTS = 5;
const SUGGEST_CATEGORIES = 3;
const SUGGEST_BRANDS = 2;

const brandCache = ttlCache(fetchSearchableBrands, 60_000);

function flatten(tree: readonly CategoryNode[]): CategoryNode[] {
  return tree.flatMap((n) => [n, ...flatten(n.children)]);
}

const emptySuggestions = (query: string): Suggestions => ({
  query,
  corrected: null,
  products: [],
  categories: [],
  brands: [],
  total: 0,
});

/**
 * Instant suggestions: a handful of products (same ranking and typo tolerance as the results page), matching
 * categories and brands (matched in memory from the cached category tree and the brand list).
 */
export async function getSuggestions(rawQuery: string): Promise<Suggestions> {
  const parsed = parseSearchQuery(rawQuery);
  if (!isSearchable(parsed)) return emptySuggestions(parsed.input);

  const filters: ListingFilters = {
    q: parsed.input,
    brands: [],
    tags: [],
    inStock: false,
    onSale: false,
    specs: {},
    sort: "relevance",
    page: 1,
  };
  const [tiered, tree, brands] = await Promise.all([
    searchTiered(
      parsed,
      (search) => ({
        filters,
        specDefs: [],
        pageSize: SUGGEST_PRODUCTS,
        withFacets: false,
        search,
      }),
      true,
    ),
    getCategoryTree(),
    brandCache.get(),
  ]);

  const { effective } = tiered;
  const categories = flatten(tree)
    .filter((c) => termsMatchText(effective, `${c.name.en} ${c.name.ar}`))
    .sort((a, b) => b.productCount - a.productCount || a.depth - b.depth)
    .slice(0, SUGGEST_CATEGORIES)
    .map((c) => ({ path: c.path, name: c.name }));
  const matchedBrands = brands
    .filter((b) => termsMatchText(effective, `${b.nameEn} ${b.nameAr ?? ""}`))
    .slice(0, SUGGEST_BRANDS)
    .map((b) => ({ slug: b.slug, name: { en: b.nameEn, ar: b.nameAr ?? b.nameEn } }));

  return {
    query: parsed.input,
    corrected: tiered.tier === "corrected" ? effective.input || effective.normalized : null,
    products: tiered.result.rows.map(toCardData).map((p) => ({
      id: p.id,
      slug: p.slug,
      type: p.type,
      title: p.title,
      effectivePrice: p.effectivePrice,
      available: p.available,
      image: p.image,
      brandName: p.brand?.name ?? null,
    })),
    categories,
    brands: matchedBrands,
    total: tiered.result.total,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Maintenance (daily jobs, src/server/jobs/registry.ts)
// ---------------------------------------------------------------------------------------------------------------

/** Zero-result searches are kept this long (analytics, not a log of what people typed). */
export const ZERO_RESULT_RETENTION_DAYS = 90;

/**
 * Safety net: the triggers keep the index current, so this changes nothing when they have done their job (a database
 * test proves a full rebuild is a no-op). It repairs the one thing triggers cannot see, a bulk `UPDATE` that bypassed
 * them (for example a session with `session_replication_role = replica`), and removes vocabulary words no product
 * contains any more. Idempotent.
 */
export async function runSearchIndexRebuild(): Promise<void> {
  await rebuildSearchIndex();
}

/** Deletes zero-result rows older than the retention period. Idempotent. Returns how many rows were removed. */
export async function pruneOldZeroResults(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ZERO_RESULT_RETENTION_DAYS * 86_400_000);
  return pruneZeroResults(cutoff.toISOString().slice(0, 10));
}
