import type { Metadata } from "next";
import { hasLocale, useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { storeName } from "@/config/brand";
import { type CategoryNode, categoryHref, categoryName } from "@/domain/category-tree";
import { clearedFilters, listingQuery, listingSeo, parseListingParams } from "@/domain/listing";
import { DemoNotice } from "@/features/catalog/demo-notice";
import { ListingEmpty } from "@/features/catalog/listing-empty";
import { ListingBody } from "@/features/catalog/listing-body";
import { categoryPath } from "@/features/navigation/href";
import type { Locale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { localeAlternates, pageMetadata } from "@/lib/seo";
import { getCategory, getSpecDefinitions } from "@/server/services/category.service";
import { type ListingView, getListing } from "@/server/services/listing.service";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = {
  params: Promise<{ locale: string; slug: string[] }>;
  searchParams: Promise<SearchParams>;
};

// Dynamic on purpose: the filters live in the query string (ADR 0016). Reference data (category tree, spec
// definitions) is cached in-process by the services; the listing statements themselves are cheap and indexed.

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const found = await getCategory(slug);
  if (!found) return {};
  const node = found.node;
  const filters = parseListingParams(await searchParams, await getSpecDefinitions(node.path));
  const seo = listingSeo(filters);
  const t = await getTranslations({ locale, namespace: "Listing" });

  const name = categoryName(node, locale);
  const baseTitle = node.seoTitle[locale] ?? name;
  const title =
    filters.page > 1 ? `${baseTitle} - ${t("pageSuffix", { page: filters.page })}` : baseTitle;
  const description =
    node.seoDescription[locale] ??
    node.description[locale] ??
    t("metaDescription", { category: name, store: storeName(locale) });
  const path = `${categoryPath(slug)}${seo.canonicalQuery}`;
  const meta = pageMetadata(locale, { title, description, path });
  return {
    title,
    ...meta,
    // hreflang only on indexable URLs; a noindex URL keeps just its own canonical (ADR 0016).
    alternates: seo.hreflang ? localeAlternates(locale, path) : { canonical: `/${locale}${path}` },
    ...(seo.indexable ? {} : { robots: { index: false, follow: true } }),
  };
}

function CategoryListing({
  node,
  chain,
  view,
}: {
  node: CategoryNode;
  chain: CategoryNode[];
  view: ListingView;
}) {
  const t = useTranslations("Listing");
  const crumbsT = useTranslations("Breadcrumb");
  const locale = useLocale() as Locale;
  const basePath = categoryHref(node.path);
  const seo = listingSeo(view.filters);
  const clearHref = `${basePath}${listingQuery(clearedFilters(view.filters), { page: false })}`;
  const crumbs = [
    { label: crumbsT("home"), href: "/" },
    ...chain.map((c, i) => ({
      label: categoryName(c, locale),
      href: categoryPath(chain.slice(0, i + 1).map((n) => n.slug)),
    })),
  ];
  const description = node.description[locale];

  return (
    <main
      id="main"
      className="max-w-page px-gutter mx-auto flex w-full flex-1 flex-col gap-5 py-6 sm:py-8"
    >
      <Breadcrumbs items={crumbs} currentPath={basePath} />
      <header className="flex flex-col gap-2">
        <h1 className="text-title font-bold text-balance">{categoryName(node, locale)}</h1>
        {description ? <p className="text-muted-foreground max-w-prose">{description}</p> : null}
      </header>
      <DemoNotice />

      {node.children.length > 0 ? (
        <nav aria-label={t("subcategories")}>
          <ul className="flex flex-wrap gap-2">
            {node.children.map((c) => (
              <li key={c.id}>
                <Link
                  href={categoryHref(c.path)}
                  className="rounded-control border-input bg-secondary text-secondary-foreground hover:bg-accent inline-flex min-h-11 items-center gap-2 border px-4"
                >
                  {categoryName(c, locale)}
                  <span className="text-small text-muted-foreground tabular-nums">
                    {c.productCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <ListingBody
        view={view}
        basePath={basePath}
        clearHref={clearHref}
        empty={<ListingEmpty clearHref={clearHref} />}
        nofollowPagination={seo.nofollowPagination}
      />
    </main>
  );
}

export default async function CategoryRoute({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const found = await getCategory(slug);
  if (!found) notFound();
  const view = await getListing(found.node.path, await searchParams);
  // A page number past the end is a 404 (page 1 of an empty result is fine: it shows the zero-result state).
  if (view.total > 0 && view.filters.page > view.pages) notFound();
  return <CategoryListing node={found.node} chain={found.chain} view={view} />;
}
