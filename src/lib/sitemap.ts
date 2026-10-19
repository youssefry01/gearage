import { locales } from "@/i18n/locales";

/**
 * Locale-less paths of pages that REALLY exist and are indexable. "Coming soon" placeholders (config/routes.ts,
 * placeholder categories) are noindex and must never be listed here. When a milestone ships a real page, add its path
 * (or its generator) in the same change: M3a categories and M3b products come from the database.
 */
export const INDEXABLE_PATHS: readonly string[] = [""];

export type SitemapEntry = { url: string; alternates: { languages: Record<string, string> } };

/** One entry per locale and path, each carrying hreflang alternates for every locale. */
export function buildSitemapEntries(
  origin: string,
  paths: readonly string[] = INDEXABLE_PATHS,
): SitemapEntry[] {
  const base = origin.replace(/\/+$/, "");
  return paths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${base}/${l}${path}`])) },
    })),
  );
}
