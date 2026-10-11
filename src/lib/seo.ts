import type { Metadata } from "next";
import { brand, localized, storeName } from "@/config/brand";
import { defaultLocale, locales, ogLocaleOf, type Locale } from "@/i18n/locales";

/** Canonical + hreflang alternates. `path` is the locale-less path ("" for home, "/cpus", ...). */
export function localeAlternates(locale: Locale, path = "") {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, `/${l}${path}`])),
      "x-default": `/${defaultLocale}${path}`,
    },
  };
}

type OpenGraphInput = { title?: string; description?: string; path?: string };

/** Full Open Graph object. Next.js REPLACES (not merges) nested metadata objects, so pages must use this, never a partial one. */
export function openGraphFor(locale: Locale, { title, description, path }: OpenGraphInput = {}) {
  const name = storeName(locale);
  return {
    type: "website" as const,
    siteName: name,
    locale: ogLocaleOf(locale),
    alternateLocale: locales.filter((l) => l !== locale).map(ogLocaleOf),
    title: title ? `${title} | ${name}` : `${name} | ${localized(brand.seo.title, locale)}`,
    description: description ?? localized(brand.seo.description, locale),
    images: [
      {
        url: brand.ogImage.src,
        width: brand.ogImage.width,
        height: brand.ogImage.height,
        alt: name,
      },
    ],
    ...(path === undefined ? {} : { url: `/${locale}${path}` }),
  };
}

/** What every page returns from generateMetadata (plus its own `title`): canonical, hreflang and a complete OG object. */
export function pageMetadata(locale: Locale, input: OpenGraphInput = {}): Metadata {
  const path = input.path ?? "";
  return {
    alternates: localeAlternates(locale, path),
    ...(input.description ? { description: input.description } : {}),
    openGraph: openGraphFor(locale, { ...input, path }),
  };
}
