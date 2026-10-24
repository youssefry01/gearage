import type { CategoryNode } from "@/domain/category-tree";
import { INDEXABLE_PATHS, categorySitemapPaths, productSitemapPaths } from "@/lib/sitemap";
import { logger } from "@/lib/logger";
import { lastGood, type LastGood } from "@/server/cache/last-good";
import { getCategoryTree } from "./category.service";
import { listPublicProductSlugs } from "./product.service";

export type SitemapSources = {
  loadCategories: () => Promise<readonly CategoryNode[]>;
  loadProductSlugs: () => Promise<readonly string[]>;
  onError?: (error: unknown) => void;
  now?: () => number;
};

const TTL_MS = 60 * 60 * 1000; // regenerate hourly, as the old `revalidate = 3600` did
const RETRY_MS = 30 * 1000; // after a failure, try again in 30 s (not on every request)

/**
 * The paths the sitemap lists: the static pages plus categories and products from the database.
 *
 * It NEVER throws. If the database fails, the last good list is served (a crawler keeps seeing the full sitemap
 * through a short outage); if there never was one (cold start during an outage) the minimal sitemap, the static
 * pages only, is served. Both are valid XML with a 200, and neither is cached for long: the degraded answer is not
 * remembered as good, and a retry runs after RETRY_MS.
 */
export function createSitemapService(src: SitemapSources): LastGood<string[]> {
  return lastGood<string[]>(
    async () => {
      // Both reads must succeed: a half-built list (categories without products) would be a misleading "good" one.
      const [tree, slugs] = await Promise.all([src.loadCategories(), src.loadProductSlugs()]);
      return [...INDEXABLE_PATHS, ...categorySitemapPaths(tree), ...productSitemapPaths(slugs)];
    },
    {
      ttlMs: TTL_MS,
      retryMs: RETRY_MS,
      fallback: [...INDEXABLE_PATHS],
      onError: src.onError,
      now: src.now,
    },
  );
}

let shared: LastGood<string[]> | undefined;

/** The process-wide instance the route uses. */
export function sitemapPaths(): Promise<{ value: string[]; degraded: boolean }> {
  shared ??= createSitemapService({
    loadCategories: getCategoryTree,
    loadProductSlugs: listPublicProductSlugs,
    onError: (error) =>
      logger.error("sitemap: database read failed, serving the last good or minimal sitemap", {
        error,
      }),
  });
  return shared.get();
}

/** Test hook. */
export function resetSitemapService(): void {
  shared = undefined;
}
