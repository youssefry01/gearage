import type { MetadataRoute } from "next";
import { buildSitemapEntries } from "@/lib/sitemap";
import { siteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemapEntries(siteUrl().origin);
}
