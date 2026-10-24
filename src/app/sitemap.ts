import type { MetadataRoute } from "next";
import { buildSitemapEntries } from "@/lib/sitemap";
import { siteUrl } from "@/lib/site-url";
import { sitemapPaths } from "@/server/services/sitemap.service";

/**
 * Dynamic on purpose. With `revalidate`, a degraded answer (the minimal sitemap served while the database was down)
 * would be cached by Next for the full hour; with a plain 500 it was never cached but crawlers saw an error. The
 * service below keeps its own hour-long cache of the LAST GOOD list and never throws, so each request is cheap and a
 * failing database degrades to "last good, else minimal" instead of a 500.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { value } = await sitemapPaths();
  return buildSitemapEntries(siteUrl().origin, value);
}
