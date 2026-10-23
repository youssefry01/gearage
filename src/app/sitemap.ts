import type { MetadataRoute } from "next";
import { INDEXABLE_PATHS, buildSitemapEntries, categorySitemapPaths } from "@/lib/sitemap";
import { siteUrl } from "@/lib/site-url";
import { getCategoryTree } from "@/server/services/category.service";

// Categories come from the database, so the sitemap is regenerated hourly rather than frozen at build time.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const categories = categorySitemapPaths(await getCategoryTree());
  return buildSitemapEntries(siteUrl().origin, [...INDEXABLE_PATHS, ...categories]);
}
