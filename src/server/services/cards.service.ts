import { isValidSlug } from "@/domain/catalog";
import { parseListingParams } from "@/domain/listing";
import { RECENT_MAX } from "@/domain/recently-viewed";
import { queryListing } from "@/server/repositories/listing.repository";
import { getSpecOwnerResolver } from "./category.service";
import { toCardData, type ProductCardData } from "./listing.service";

/**
 * Cards for a list of slugs (the recently viewed shelf), in the requested order. Uses the shared listing query, so
 * the visibility rule is the same as everywhere: a product that was hidden since the shopper saw it simply does not
 * come back (the caller drops it from the device list). Two statements (rows and total) however many slugs.
 */
export async function getCardsBySlugs(slugs: readonly string[]): Promise<ProductCardData[]> {
  const wanted = [...new Set(slugs.filter(isValidSlug))].slice(0, RECENT_MAX);
  if (!process.env.DATABASE_URL || wanted.length === 0) return [];
  const owner = await getSpecOwnerResolver();
  const { rows } = await queryListing({
    filters: parseListingParams({}),
    specDefs: [],
    pageSize: wanted.length,
    withFacets: false,
    slugs: wanted,
  });
  const bySlug = new Map(rows.map((r) => [r.slug, toCardData(r, owner)]));
  return wanted.flatMap((s) => (bySlug.has(s) ? [bySlug.get(s) as ProductCardData] : []));
}
