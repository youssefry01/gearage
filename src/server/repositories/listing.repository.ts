import { Prisma } from "@/generated/prisma/client";
import { type ListingFilters, type Sort, listingFacets } from "@/domain/listing";
import type { SpecDef } from "@/domain/specs";
import { getDb } from "@/server/db";
import { VISIBLE_PRODUCT } from "./visibility";

type Db = ReturnType<typeof getDb>;

export type ListingRow = {
  id: string;
  type: "PHYSICAL" | "BUNDLE" | "GIFT_CARD" | "DIGITAL";
  slug: string;
  titleEn: string;
  titleAr: string;
  brandSlug: string | null;
  brandNameEn: string | null;
  brandNameAr: string | null;
  categoryPath: string;
  effectivePrice: number;
  listTotal: number;
  compareAtPrice: number | null;
  /** null = not stock-tracked. */
  available: number | null;
  lowStockThreshold: number;
  imageKey: string | null;
  imageAltEn: string | null;
  imageAltAr: string | null;
  /** Bundles only; 0 otherwise. */
  componentCount: number;
};

/** Counts of products per option, each computed with every OTHER filter applied (disjunctive faceting). */
export type FacetCounts = {
  /** Search only: products per category one level below the selected category (or per top-level category). */
  categories: Record<string, number>;
  brands: Record<string, number>;
  tags: Record<string, number>;
  price: { min: number; max: number } | null;
  inStock: number;
  onSale: number;
  specs: Record<
    string,
    { counts: Record<string, number> } | { min: number; max: number } | { count: number }
  >;
};

export type ListingResult = { rows: ListingRow[]; total: number; facets: FacetCounts };

export type ListingQuery = {
  /** Category path; the category and everything below it. Omit for the whole catalog. */
  categoryPath?: string;
  filters: ListingFilters;
  /** The category's filter config. Only filterable facets are queried. */
  specDefs: readonly SpecDef[];
  pageSize: number;
  /** Skip the facet query (home sections, related products, which only need rows). */
  withFacets?: boolean;
  /** Only bundles that contain this product as a component ("included in these bundles"). */
  componentId?: string;
  /** Leave this product out (related products never list the product itself). */
  excludeProductId?: string;
  /** Search: only products whose document matches, ranked by relevance (ADR 0019). */
  search?: SearchMatch;
  /** Search results also count products per sub-category (the category facet). */
  withCategoryFacet?: boolean;
};

/**
 * A built search: the tsquery text that decides which products match (from domain/search), optionally a wider one
 * used only for ranking (partial matches rank products that also have the number higher), and LIKE patterns for the
 * phrase boost.
 */
export type SearchMatch = {
  tsQuery: string;
  rankTsQuery?: string;
  /** Partial matches: one tsquery per term; products matching more of them rank first. */
  termTsQueries?: string[];
  phrasePatterns: string[];
};

// ---------------------------------------------------------------------------------------------------------------
// SQL building blocks. Every value goes through a bind parameter; only fixed fragments are concatenated, and the
// ORDER BY is chosen from a closed map keyed by the validated Sort.
// ---------------------------------------------------------------------------------------------------------------

const FROM_BASE = Prisma.sql`FROM "product" p
  JOIN "category" cat ON cat."id" = p."categoryId"
  JOIN "product_pricing" pr ON pr."productId" = p."id"
  JOIN "product_availability" av ON av."productId" = p."id"
  LEFT JOIN "brand" b ON b."id" = p."brandId"`;

/** The FROM clause; a search joins its document table. */
const from = (q: ListingQuery): Prisma.Sql =>
  q.search
    ? Prisma.sql`${FROM_BASE} JOIN "product_search" ps ON ps."productId" = p."id"`
    : FROM_BASE;

/** Savings in piastres: compare-at for physical products, parts total for bundles. Mirrors domain cardSavings. */
const SAVINGS = Prisma.sql`(CASE WHEN p."type" = 'BUNDLE'
    THEN GREATEST(pr."listTotal" - pr."effectivePrice", 0)
    ELSE GREATEST(COALESCE(p."compareAtPrice", 0) - pr."effectivePrice", 0) END)`;

const SAVINGS_BASE = Prisma.sql`(CASE WHEN p."type" = 'BUNDLE' THEN pr."listTotal" ELSE COALESCE(p."compareAtPrice", 0) END)`;

const IN_STOCK = Prisma.sql`(av."available" IS NULL OR av."available" > 0)`;

const ORDER_BY: Record<Sort, Prisma.Sql> = {
  // Only reachable without a search term, where parsing never produces it; the safe fallback is "popular".
  relevance: Prisma.sql`(av."available" IS NOT NULL AND av."available" <= 0), p."viewCount" DESC, p."unitsSold" DESC, p."id"`,
  // In-stock first, then what shoppers look at, then what sells.
  popular: Prisma.sql`(av."available" IS NOT NULL AND av."available" <= 0), p."viewCount" DESC, p."unitsSold" DESC, p."id"`,
  "best-selling": Prisma.sql`p."unitsSold" DESC, p."viewCount" DESC, p."id"`,
  newest: Prisma.sql`p."createdAt" DESC, p."id"`,
  "price-asc": Prisma.sql`pr."effectivePrice" ASC, p."id"`,
  "price-desc": Prisma.sql`pr."effectivePrice" DESC, p."id"`,
  discount: Prisma.sql`(${SAVINGS} * 1000 / NULLIF(${SAVINGS_BASE}, 0)) DESC NULLS LAST, ${SAVINGS} DESC, p."id"`,
};

/**
 * Relevance: titles that contain what was typed come first, then the weighted text-search rank (title and brand
 * count most, then categories and tags, descriptions, specs), then what a shopper can buy, then popularity.
 */
function orderBy(q: ListingQuery): Prisma.Sql {
  if (q.filters.sort === "relevance" && q.search) {
    const terms = q.search.termTsQueries ?? [];
    const matched =
      terms.length > 1
        ? Prisma.sql`(${Prisma.join(
            terms.map(
              (t) =>
                Prisma.sql`(CASE WHEN ps."vector" @@ to_tsquery('simple', ${t}) THEN 1 ELSE 0 END)`,
            ),
            " + ",
          )}) DESC,`
        : Prisma.empty;
    return Prisma.sql`${matched} (CASE WHEN ps."titleFold" LIKE ANY(${q.search.phrasePatterns}::text[]) THEN 0 ELSE 1 END),
      ts_rank_cd('{0.1,0.2,0.4,1.0}', ps."vector", to_tsquery('simple', ${q.search.rankTsQuery ?? q.search.tsQuery}), 1) DESC,
      (av."available" IS NOT NULL AND av."available" <= 0), p."viewCount" DESC, p."id"`;
  }
  return ORDER_BY[q.filters.sort];
}

const likePrefix = (path: string): string => `${path.replace(/[\\%_]/g, "\\$&")}/%`;

type FacetId = "brand" | "tag" | "price" | "in_stock" | "sale" | `spec:${string}`;

function specCondition(
  def: SpecDef,
  sel: NonNullable<ListingFilters["specs"][string]>,
): Prisma.Sql {
  const key = def.key;
  if (sel.values) {
    return def.type === "STRING_LIST"
      ? Prisma.sql`(jsonb_typeof(p."specs" -> ${key}::text) = 'array' AND p."specs" -> ${key}::text ?| ${sel.values}::text[])`
      : Prisma.sql`(p."specs" ->> ${key}::text) = ANY(${sel.values}::text[])`;
  }
  if (sel.on) return Prisma.sql`(p."specs" -> ${key}::text) = 'true'::jsonb`;
  const num = Prisma.sql`(CASE WHEN jsonb_typeof(p."specs" -> ${key}::text) = 'number' THEN (p."specs" ->> ${key}::text)::numeric END)`;
  const parts: Prisma.Sql[] = [];
  if (sel.min !== undefined) parts.push(Prisma.sql`${num} >= ${sel.min}`);
  if (sel.max !== undefined) parts.push(Prisma.sql`${num} <= ${sel.max}`);
  return parts.length > 0 ? Prisma.join(parts, " AND ") : Prisma.sql`TRUE`;
}

/** WHERE conditions for the query, optionally leaving out one facet (for that facet's own counts). */
function conditions(q: ListingQuery, skip?: FacetId): Prisma.Sql {
  const f = q.filters;
  // The shared visibility rule (ACTIVE, not deleted, active category, active brand or none).
  const c: Prisma.Sql[] = [VISIBLE_PRODUCT];
  if (q.search) c.push(Prisma.sql`ps."vector" @@ to_tsquery('simple', ${q.search.tsQuery})`);
  if (q.categoryPath)
    c.push(
      Prisma.sql`(cat."path" = ${q.categoryPath} OR cat."path" LIKE ${likePrefix(q.categoryPath)})`,
    );
  if (q.componentId)
    c.push(Prisma.sql`EXISTS (SELECT 1 FROM "bundle_item" bi
      WHERE bi."bundleId" = p."id" AND bi."componentId" = ${q.componentId}::uuid)`);
  if (q.excludeProductId) c.push(Prisma.sql`p."id" <> ${q.excludeProductId}::uuid`);
  if (skip !== "brand" && f.brands.length > 0)
    c.push(Prisma.sql`b."slug" = ANY(${f.brands}::text[])`);
  if (skip !== "tag" && f.tags.length > 0)
    c.push(Prisma.sql`EXISTS (SELECT 1 FROM "product_tag" pt JOIN "tag" t ON t."id" = pt."tagId"
      WHERE pt."productId" = p."id" AND t."slug" = ANY(${f.tags}::text[]))`);
  if (skip !== "price") {
    if (f.priceMin !== undefined) c.push(Prisma.sql`pr."effectivePrice" >= ${f.priceMin}`);
    if (f.priceMax !== undefined) c.push(Prisma.sql`pr."effectivePrice" <= ${f.priceMax}`);
  }
  if (skip !== "in_stock" && f.inStock) c.push(IN_STOCK);
  if (skip !== "sale" && f.onSale) c.push(Prisma.sql`${SAVINGS} > 0`);
  const defs = new Map(listingFacets(q.specDefs).map((d) => [d.key, d]));
  for (const [key, sel] of Object.entries(f.specs)) {
    const def = defs.get(key);
    if (def && skip !== `spec:${key}`) c.push(specCondition(def, sel));
  }
  return Prisma.join(c, " AND ");
}

function facetQuery(q: ListingQuery): Prisma.Sql {
  const part = (select: Prisma.Sql, from: Prisma.Sql, where: Prisma.Sql, tail = Prisma.empty) =>
    Prisma.sql`(SELECT ${select} ${from} WHERE ${where} ${tail})`;
  const cols = (g: Prisma.Sql, k: Prisma.Sql, n: Prisma.Sql, lo: Prisma.Sql, hi: Prisma.Sql) =>
    Prisma.sql`${g}::text AS g, ${k}::text AS k, ${n}::int AS n, ${lo}::numeric AS lo, ${hi}::numeric AS hi`;
  const nul = Prisma.sql`NULL`;
  const parts: Prisma.Sql[] = [
    part(
      cols(Prisma.sql`'brand'`, Prisma.sql`b."slug"`, Prisma.sql`COUNT(*)`, nul, nul),
      from(q),
      Prisma.sql`${conditions(q, "brand")} AND b."slug" IS NOT NULL`,
      Prisma.sql`GROUP BY b."slug"`,
    ),
    part(
      cols(Prisma.sql`'tag'`, Prisma.sql`t."slug"`, Prisma.sql`COUNT(*)`, nul, nul),
      Prisma.sql`${from(q)} JOIN "product_tag" pt ON pt."productId" = p."id" JOIN "tag" t ON t."id" = pt."tagId"`,
      conditions(q, "tag"),
      Prisma.sql`GROUP BY t."slug"`,
    ),
    part(
      cols(
        Prisma.sql`'price'`,
        nul,
        Prisma.sql`COUNT(*)`,
        Prisma.sql`MIN(pr."effectivePrice")`,
        Prisma.sql`MAX(pr."effectivePrice")`,
      ),
      from(q),
      conditions(q, "price"),
    ),
    part(
      cols(Prisma.sql`'in_stock'`, nul, Prisma.sql`COUNT(*) FILTER (WHERE ${IN_STOCK})`, nul, nul),
      from(q),
      conditions(q, "in_stock"),
    ),
    part(
      cols(Prisma.sql`'sale'`, nul, Prisma.sql`COUNT(*) FILTER (WHERE ${SAVINGS} > 0)`, nul, nul),
      from(q),
      conditions(q, "sale"),
    ),
  ];

  if (q.withCategoryFacet) {
    // Products per category one level below the selected one (or per top-level category). Products sitting directly
    // in the selected category have no deeper segment and are not counted here.
    const depth = q.categoryPath ? q.categoryPath.split("/").length : 0;
    const segments = Prisma.sql`string_to_array(cat."path", '/')`;
    parts.push(
      part(
        cols(
          Prisma.sql`'category'`,
          Prisma.sql`array_to_string((${segments})[1:${depth + 1}::int], '/')`,
          Prisma.sql`COUNT(*)`,
          nul,
          nul,
        ),
        from(q),
        Prisma.sql`${conditions(q)} AND cardinality(${segments}) > ${depth}::int`,
        Prisma.sql`GROUP BY 2`,
      ),
    );
  }

  for (const def of listingFacets(q.specDefs)) {
    const id: FacetId = `spec:${def.key}`;
    const g = Prisma.sql`${id}`;
    const key = Prisma.sql`${def.key}::text`;
    const where = conditions(q, id);
    if (def.facet === "CHECKBOX" && def.type === "STRING_LIST") {
      parts.push(
        part(
          cols(g, Prisma.sql`v.val`, Prisma.sql`COUNT(DISTINCT p."id")`, nul, nul),
          Prisma.sql`${from(q)} CROSS JOIN LATERAL jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(p."specs" -> ${key}) = 'array' THEN p."specs" -> ${key} ELSE '[]'::jsonb END) AS v(val)`,
          where,
          Prisma.sql`GROUP BY v.val`,
        ),
      );
    } else if (def.facet === "CHECKBOX") {
      parts.push(
        part(
          cols(g, Prisma.sql`p."specs" ->> ${key}`, Prisma.sql`COUNT(*)`, nul, nul),
          from(q),
          Prisma.sql`${where} AND p."specs" ->> ${key} IS NOT NULL`,
          // By ordinal: the key is a bind parameter, so repeating the expression here would be a different parameter.
          Prisma.sql`GROUP BY 2`,
        ),
      );
    } else if (def.facet === "TOGGLE") {
      parts.push(
        part(
          cols(
            g,
            nul,
            Prisma.sql`COUNT(*) FILTER (WHERE (p."specs" -> ${key}) = 'true'::jsonb)`,
            nul,
            nul,
          ),
          from(q),
          where,
        ),
      );
    } else if (def.facet === "RANGE") {
      const num = Prisma.sql`(CASE WHEN jsonb_typeof(p."specs" -> ${key}) = 'number' THEN (p."specs" ->> ${key})::numeric END)`;
      parts.push(
        part(
          cols(g, nul, Prisma.sql`COUNT(${num})`, Prisma.sql`MIN(${num})`, Prisma.sql`MAX(${num})`),
          from(q),
          where,
        ),
      );
    }
  }
  return Prisma.join(parts, " UNION ALL ");
}

type FacetRow = { g: string; k: string | null; n: number; lo: string | null; hi: string | null };

function foldFacets(rows: readonly FacetRow[], defs: readonly SpecDef[]): FacetCounts {
  const out: FacetCounts = {
    categories: {},
    brands: {},
    tags: {},
    price: null,
    inStock: 0,
    onSale: 0,
    specs: {},
  };
  const kinds = new Map(defs.map((d) => [d.key, d.facet]));
  for (const r of rows) {
    if (r.g === "category" && r.k) out.categories[r.k] = r.n;
    else if (r.g === "brand" && r.k) out.brands[r.k] = r.n;
    else if (r.g === "tag" && r.k) out.tags[r.k] = r.n;
    else if (r.g === "price") {
      if (r.n > 0 && r.lo !== null && r.hi !== null)
        out.price = { min: Number(r.lo), max: Number(r.hi) };
    } else if (r.g === "in_stock") out.inStock = r.n;
    else if (r.g === "sale") out.onSale = r.n;
    else if (r.g.startsWith("spec:")) {
      const key = r.g.slice(5);
      const kind = kinds.get(key);
      if (kind === "CHECKBOX" && r.k !== null) {
        const entry = (out.specs[key] ??= { counts: {} });
        if ("counts" in entry) entry.counts[r.k] = r.n;
      } else if (kind === "RANGE") {
        if (r.n > 0 && r.lo !== null && r.hi !== null)
          out.specs[key] = { min: Number(r.lo), max: Number(r.hi) };
      } else if (kind === "TOGGLE") out.specs[key] = { count: r.n };
    }
  }
  return out;
}

/**
 * One listing request = exactly three statements, independent of how many products, facets or options exist:
 * the page of rows (with brand, primary image and bundle size joined in), the total, and ALL facet counts as a
 * single UNION ALL. No per-product or per-facet round trips (no N+1).
 */
export async function queryListing(q: ListingQuery, db: Db = getDb()): Promise<ListingResult> {
  const offset = (q.filters.page - 1) * q.pageSize;
  const rowsP = db.$queryRaw<ListingRow[]>`
    SELECT p."id", p."type", p."slug", p."titleEn", p."titleAr",
           b."slug" AS "brandSlug", b."nameEn" AS "brandNameEn", b."nameAr" AS "brandNameAr",
           cat."path" AS "categoryPath",
           pr."effectivePrice"::int AS "effectivePrice", pr."listTotal"::int AS "listTotal",
           p."compareAtPrice", av."available"::int AS "available", p."lowStockThreshold",
           img."storageKey" AS "imageKey", img."altEn" AS "imageAltEn", img."altAr" AS "imageAltAr",
           (CASE WHEN p."type" = 'BUNDLE'
              THEN (SELECT COUNT(*)::int FROM "bundle_item" bi WHERE bi."bundleId" = p."id") ELSE 0 END) AS "componentCount"
    ${from(q)}
    LEFT JOIN LATERAL (
      SELECT i."storageKey", i."altEn", i."altAr" FROM "product_image" i
      WHERE i."productId" = p."id" ORDER BY i."sortOrder", i."id" LIMIT 1) img ON TRUE
    WHERE ${conditions(q)}
    ORDER BY ${orderBy(q)}
    LIMIT ${q.pageSize} OFFSET ${offset}`;
  const totalP = db.$queryRaw<
    { n: number }[]
  >`SELECT COUNT(*)::int AS n ${from(q)} WHERE ${conditions(q)}`;
  const facetsP =
    q.withFacets === false
      ? Promise.resolve<FacetRow[]>([])
      : db.$queryRaw<FacetRow[]>(facetQuery(q));
  const [rows, total, facetRows] = await Promise.all([rowsP, totalP, facetsP]);
  return {
    rows,
    total: total[0]?.n ?? 0,
    facets: foldFacets(facetRows, listingFacets(q.specDefs)),
  };
}

/** Distinct brand / tag labels for the facet options that exist in a result (names for the slugs). */
export async function fetchBrandNames(
  slugs: readonly string[],
  db: Db = getDb(),
): Promise<{ slug: string; nameEn: string; nameAr: string | null }[]> {
  if (slugs.length === 0) return [];
  return db.$queryRaw`SELECT "slug", "nameEn", "nameAr" FROM "brand" WHERE "slug" = ANY(${[...slugs]}::text[]) ORDER BY "nameEn"`;
}

export async function fetchTagNames(
  slugs: readonly string[],
  db: Db = getDb(),
): Promise<{ slug: string; nameEn: string; nameAr: string }[]> {
  if (slugs.length === 0) return [];
  return db.$queryRaw`SELECT "slug", "nameEn", "nameAr" FROM "tag" WHERE "slug" = ANY(${[...slugs]}::text[]) ORDER BY "nameEn"`;
}
