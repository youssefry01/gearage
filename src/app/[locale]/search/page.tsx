import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { routes } from "@/config/routes";
import { storeName } from "@/config/brand";
import { parseListingParams, searchSeo } from "@/domain/listing";
import { SearchResults } from "@/features/search/search-view";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { getCategoryTree } from "@/server/services/category.service";
import { getSearchView, logZeroResult } from "@/server/services/search.service";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

// Dynamic on purpose: the query and filters live in the URL (ADR 0019).

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const filters = parseListingParams(await searchParams, [], { search: true });
  const t = await getTranslations({ locale, namespace: "Search" });
  const list = await getTranslations({ locale, namespace: "Listing" });
  const store = storeName(locale);
  const base = filters.q ? t("metaTitleFor", { query: filters.q }) : t("allProducts");
  const title = filters.page > 1 ? `${base} - ${list("pageSuffix", { page: filters.page })}` : base;
  const description = filters.q
    ? t("metaDescriptionFor", { query: filters.q, store })
    : t("metaDescriptionAll", { store });
  const path = `${routes.search}${searchSeo(filters).canonicalQuery}`;
  return {
    title,
    ...pageMetadata(locale, { title, description, path }),
    // A noindex page keeps only its own canonical and joins no hreflang cluster.
    alternates: { canonical: `/${locale}${path}` },
    robots: { index: false, follow: true },
  };
}

export default async function SearchRoute({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const view = await getSearchView(await searchParams);
  // A page number past the end is a 404 (page 1 of an empty result is the zero-result state).
  if (view.total > 0 && view.filters.page > view.pages) notFound();

  // Zero-result analytics: after the response is sent, never on the shopper's critical path.
  const zeroTerm = view.zeroResultTerm;
  if (zeroTerm) after(() => logZeroResult(zeroTerm));

  const topCategories =
    view.total === 0 ? (await getCategoryTree()).map((c) => ({ path: c.path, name: c.name })) : [];
  return <SearchResults view={view} topCategories={topCategories} />;
}
