import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { activeFilterCount } from "@/domain/listing";
import type { ListingView } from "@/server/services/listing.service";
import { ActiveFilters } from "./active-filters";
import { FilterDrawer } from "./filter-drawer";
import {
  ClearAllLink,
  FilterPanel,
  type CategoryFacetData,
  type FilterPanelData,
} from "./filter-panel";
import { Pagination } from "./pagination";
import { ProductGrid } from "./product-card";
import { SortSelect } from "./sort-select";

/**
 * The part of a listing page below its heading: filter sidebar (drawer below lg), result count, sort, active filter
 * chips, the product grid (or the page's own empty state) and pagination. Category pages and the search results page
 * both render it, so filtering, sorting and paging behave identically in both.
 */
export function ListingBody({
  view,
  basePath,
  clearHref,
  empty,
  nofollowPagination,
  categoryFacet,
  categoryLabel,
}: {
  view: ListingView;
  /** Locale-less path the filters and links are built on ("/c/components/cpus", "/search"). */
  basePath: string;
  clearHref: string;
  /** Shown instead of the grid when there are no products. */
  empty: ReactNode;
  nofollowPagination: boolean;
  categoryFacet?: CategoryFacetData;
  categoryLabel?: string;
}) {
  const t = useTranslations("Listing");
  const panel: FilterPanelData = {
    filters: view.filters,
    ...(categoryFacet ? { categoryFacet } : {}),
    specDefs: view.specDefs,
    brandOptions: view.brandOptions,
    tagOptions: view.tagOptions,
    specFacets: view.specFacets,
    priceBounds: view.priceBounds,
    inStockCount: view.inStockCount,
    onSaleCount: view.onSaleCount,
  };

  return (
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
        <ActiveFilters
          view={view}
          basePath={basePath}
          clearHref={clearHref}
          {...(categoryLabel ? { categoryLabel } : {})}
        />
        {view.total === 0 ? empty : <ProductGrid products={view.items} />}
        <Pagination
          basePath={basePath}
          filters={view.filters}
          pages={view.pages}
          nofollow={nofollowPagination}
        />
      </section>
    </div>
  );
}
