import { SearchX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { buttonStyles } from "@/components/ui/button";
import { routes } from "@/config/routes";
import {
  clearedFilters,
  listingQuery,
  searchSeo,
  withCategory,
  withoutQuery,
} from "@/domain/listing";
import { DemoNotice } from "@/features/catalog/demo-notice";
import type { CategoryFacetData } from "@/features/catalog/filter-panel";
import { ListingBody } from "@/features/catalog/listing-body";
import { ListingEmpty } from "@/features/catalog/listing-empty";
import type { Locale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import type { Bilingual } from "@/server/services/listing.service";
import type { SearchView } from "@/server/services/search.service";

const hrefFor = (filters: Parameters<typeof listingQuery>[0]): string =>
  `${routes.search}${listingQuery(filters)}`;

function categoryFacetData(view: SearchView): CategoryFacetData {
  const { filters } = view;
  return {
    allHref: filters.category ? hrefFor(withCategory(filters, undefined)) : null,
    trail: view.categoryTrail.map((c) => ({
      name: c.name,
      href: hrefFor(withCategory(filters, c.path)),
    })),
    options: view.categoryOptions.map((o) => ({
      name: o.name,
      href: hrefFor(withCategory(filters, o.path)),
      count: o.count,
    })),
  };
}

function Empty({
  view,
  topCategories,
  clearHref,
}: {
  view: SearchView;
  topCategories: { path: string; name: Bilingual }[];
  clearHref: string;
}) {
  const t = useTranslations("Search");
  const locale = useLocale() as Locale;
  const { filters } = view;

  if (view.tooShort) return <Panel title={t("tooShortTitle")} body={t("tooShortBody")} />;
  if (filters.q && filters.category)
    return (
      <Panel title={t("noResultsInCategory", { query: filters.q })} body={t("noResultsBody")}>
        <Link href={hrefFor(withCategory(filters, undefined))} className={buttonStyles()}>
          {t("searchAllCategories")}
        </Link>
      </Panel>
    );
  if (
    !filters.q ||
    view.filters.brands.length + view.filters.tags.length > 0 ||
    filters.inStock ||
    filters.onSale ||
    filters.priceMin !== undefined ||
    filters.priceMax !== undefined ||
    Object.keys(filters.specs).length > 0
  )
    return <ListingEmpty clearHref={clearHref} />;

  return (
    <Panel title={t("noResultsTitle", { query: filters.q })} body={t("noResultsBody")}>
      {topCategories.length > 0 ? (
        <nav aria-label={t("browseCategories")} className="flex flex-col items-center gap-2">
          <p className="text-small text-muted-foreground">{t("browseCategories")}</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {topCategories.map((c) => (
              <li key={c.path}>
                <Link
                  href={`/c/${c.path}`}
                  className="rounded-control border-input bg-secondary text-secondary-foreground hover:bg-accent inline-flex min-h-11 items-center border px-4"
                >
                  {c.name[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </Panel>
  );
}

function Panel({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className="border-border bg-card rounded-panel flex flex-col items-center gap-3 border px-6 py-12 text-center"
    >
      <SearchX aria-hidden="true" className="text-muted-foreground size-10" />
      <h2 className="text-heading font-semibold break-words">{title}</h2>
      <p className="text-muted-foreground max-w-prose">{body}</p>
      {children}
    </div>
  );
}

/** The search results page: also the all-products, deals, best-sellers and new-arrivals views (no search term). */
export function SearchResults({
  view,
  topCategories,
}: {
  view: SearchView;
  /** Top-level categories, offered when nothing was found. */
  topCategories: { path: string; name: Bilingual }[];
}) {
  const t = useTranslations("Search");
  const crumbsT = useTranslations("Breadcrumb");
  const locale = useLocale() as Locale;
  const { filters } = view;
  const seo = searchSeo(filters);
  const clearHref = hrefFor(clearedFilters(filters));
  const title = filters.q ? t("titleFor", { query: filters.q }) : t("allProducts");
  const lastCategory = view.categoryTrail[view.categoryTrail.length - 1];

  return (
    <main
      id="main"
      className="max-w-page px-gutter mx-auto flex w-full flex-1 flex-col gap-5 py-6 sm:py-8"
    >
      <Breadcrumbs
        items={[
          { label: crumbsT("home"), href: "/" },
          { label: filters.q ? t("title") : t("allProducts") },
        ]}
        currentPath={routes.search}
      />
      <header className="flex flex-col gap-2">
        <h1 className="text-title font-bold text-balance break-words">{title}</h1>
        {filters.q ? (
          <p>
            <Link
              href={hrefFor(withoutQuery(filters))}
              className="text-link hover:text-link-hover rounded-control inline-flex min-h-11 items-center underline underline-offset-4"
            >
              {t("clearSearch")}
            </Link>
          </p>
        ) : (
          <p className="text-muted-foreground max-w-prose">{t("allProductsLead")}</p>
        )}
      </header>
      <DemoNotice />

      {view.tier === "corrected" && view.correctedQuery && filters.q ? (
        <p className="border-border bg-card rounded-control border px-3 py-2">
          {t("correctedNotice", { original: filters.q, corrected: view.correctedQuery })}
        </p>
      ) : null}
      {view.tier === "partial" && filters.q ? (
        <p className="border-border bg-card rounded-control border px-3 py-2">
          {t("partialNotice", { query: filters.q })}
        </p>
      ) : null}

      <ListingBody
        view={view}
        basePath={routes.search}
        clearHref={clearHref}
        empty={<Empty view={view} topCategories={topCategories} clearHref={clearHref} />}
        nofollowPagination={seo.nofollowPagination}
        categoryFacet={categoryFacetData(view)}
        {...(lastCategory ? { categoryLabel: lastCategory.name[locale] } : {})}
      />
    </main>
  );
}
