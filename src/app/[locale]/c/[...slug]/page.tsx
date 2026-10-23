import type { Metadata } from "next";
import { hasLocale, useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { storeName } from "@/config/brand";
import { type CategoryNode, categoryHref, categoryName } from "@/domain/category-tree";
import {
  activeFilterCount,
  clearedFilters,
  listingQuery,
  listingSeo,
  parseListingParams,
} from "@/domain/listing";
import { ActiveFilters } from "@/features/catalog/active-filters";
import { DemoNotice } from "@/features/catalog/demo-notice";
import { FilterDrawer } from "@/features/catalog/filter-drawer";
import { FilterPanel, type FilterPanelData, ClearAllLink } from "@/features/catalog/filter-panel";
import { ListingEmpty } from "@/features/catalog/listing-empty";
import { Pagination } from "@/features/catalog/pagination";
import { ProductGrid } from "@/features/catalog/product-card";
import { SortSelect } from "@/features/catalog/sort-select";
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
  const panel: FilterPanelData = {
    filters: view.filters,
    specDefs: view.specDefs,
    brandOptions: view.brandOptions,
    tagOptions: view.tagOptions,
    specFacets: view.specFacets,
    priceBounds: view.priceBounds,
    inStockCount: view.inStockCount,
    onSaleCount: view.onSaleCount,
  };
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
      <Breadcrumbs items={crumbs} />
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

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <aside
          aria-labelledby="filters-heading"
          className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pe-2"
        >
          <h2 id="filters-heading" className="text-heading mb-1 font-semibold">
            {t("filters")}
          </h2>
          <FilterPanel data={panel} idPrefix="side" autoApply />
          {activeFilterCount(view.filters) > 0 ? (
            <ClearAllLink
              href={clearHref}
              className="text-link hover:text-link-hover rounded-control mt-2 inline-flex min-h-11 items-center underline underline-offset-4"
            />
          ) : null}
        </aside>

        <section aria-labelledby="products-heading" className="flex min-w-0 flex-col gap-4">
          <h2 id="products-heading" className="sr-only">
            {t("productsHeading")}
          </h2>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-muted-foreground">
              {t("resultCount", { count: view.total })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <FilterDrawer data={panel} clearHref={clearHref} />
              <SortSelect filters={view.filters} />
            </div>
          </div>
          <ActiveFilters view={view} basePath={basePath} clearHref={clearHref} />
          {view.total === 0 ? (
            <ListingEmpty clearHref={clearHref} />
          ) : (
            <ProductGrid products={view.items} />
          )}
          <Pagination
            basePath={basePath}
            filters={view.filters}
            pages={view.pages}
            nofollow={seo.nofollowPagination}
          />
        </section>
      </div>
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
