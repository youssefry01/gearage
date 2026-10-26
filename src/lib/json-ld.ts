import { formatDecimal } from "@/domain/money";

/**
 * Serializes a JSON-LD object for an inline `<script type="application/ld+json">`. `JSON.stringify` alone is not safe
 * there: a product title containing `</script>` would end the script element. Escaping `<` (and the two line
 * separators JavaScript treats as newlines) keeps the output valid JSON and inert HTML.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** `url` may be omitted for the current page when its canonical URL is not known (schema.org allows it on the last item). */
export type BreadcrumbItem = { name: string; url?: string };

export function breadcrumbJsonLd(items: readonly BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  };
}

export type ProductJsonLdInput = {
  name: string;
  description: string | null;
  url: string;
  /** Absolute URLs of RASTER images only (search engines ignore SVG). */
  images: readonly string[];
  sku: string;
  mpn: string | null;
  brandName: string | null;
  condition: "NEW" | "REFURBISHED";
  /** null = leave the Offer out (demo catalog: illustrative prices must not be published as structured data). */
  offer: { price: number; available: number | null } | null;
  /** Stable language tag of the page, e.g. "en". */
  inLanguage: string;
};

const CONDITION = {
  NEW: "https://schema.org/NewCondition",
  REFURBISHED: "https://schema.org/RefurbishedCondition",
} as const;

export function productJsonLd(p: ProductJsonLdInput) {
  const inStock = p.offer !== null && (p.offer.available === null || p.offer.available > 0);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    ...(p.description ? { description: p.description } : {}),
    url: p.url,
    sku: p.sku,
    ...(p.mpn ? { mpn: p.mpn } : {}),
    ...(p.images.length > 0 ? { image: [...p.images] } : {}),
    ...(p.brandName ? { brand: { "@type": "Brand", name: p.brandName } } : {}),
    itemCondition: CONDITION[p.condition],
    inLanguage: p.inLanguage,
    ...(p.offer
      ? {
          offers: {
            "@type": "Offer",
            url: p.url,
            priceCurrency: "EGP",
            price: formatDecimal(p.offer.price),
            itemCondition: CONDITION[p.condition],
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        }
      : {}),
  };
}

/**
 * Organization and WebSite for the home page. Deliberately minimal: name, URL and logo are facts from the brand
 * config. No contact points or social profiles yet: contact details are editable store settings (launch blockers in
 * HANDOFF). The WebSite carries a SearchAction pointing at the real results page (M4a). Note: Google retired the
 * sitelinks search box in November 2024 and no longer uses this markup; it stays valid schema.org and harmless.
 */
export function organizationJsonLd(input: { name: string; url: string; logo: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: input.url,
    logo: input.logo,
  };
}

export function websiteJsonLd(input: {
  name: string;
  url: string;
  inLanguage: string;
  /** Absolute URL of the results page with the literal placeholder {search_term_string} as the query. */
  searchUrlTemplate?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    url: input.url,
    inLanguage: input.inLanguage,
    ...(input.searchUrlTemplate
      ? {
          potentialAction: {
            "@type": "SearchAction",
            target: { "@type": "EntryPoint", urlTemplate: input.searchUrlTemplate },
            "query-input": "required name=search_term_string",
          },
        }
      : {}),
  };
}
