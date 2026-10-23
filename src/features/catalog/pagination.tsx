import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ListingFilters, listingQuery, pageWindow, withPage } from "@/domain/listing";
import { Link } from "@/i18n/navigation";

const item =
  "rounded-control inline-flex min-h-11 min-w-11 items-center justify-center gap-1 px-3 font-medium";
const idle = `${item} hover:bg-accent hover:text-accent-foreground`;
const current = `${item} bg-primary text-primary-foreground`;
const disabled = `${item} text-muted-foreground opacity-50`;

/**
 * Classic numbered pagination. Every page is a plain, crawlable link (`?page=N`); page 1 is the clean URL.
 * On filtered/sorted sets (noindex) the links carry rel="nofollow" so crawlers do not wander the facet space.
 */
export function Pagination({
  basePath,
  filters,
  pages,
  nofollow,
}: {
  basePath: string;
  filters: ListingFilters;
  pages: number;
  nofollow: boolean;
}) {
  const t = useTranslations("Pagination");
  if (pages <= 1) return null;
  const href = (page: number) => `${basePath}${listingQuery(withPage(filters, page))}`;
  const rel = (extra?: "prev" | "next") =>
    [nofollow ? "nofollow" : null, extra ?? null].filter(Boolean).join(" ") || undefined;
  const page = filters.page;

  return (
    <nav aria-label={t("label")} className="flex flex-col items-center gap-2">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={href(page - 1)} rel={rel("prev")} className={idle}>
              <ChevronLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
              <span className="sr-only sm:not-sr-only">{t("previous")}</span>
            </Link>
          ) : (
            <span aria-disabled="true" className={disabled}>
              <ChevronLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
              <span className="sr-only sm:not-sr-only">{t("previous")}</span>
            </span>
          )}
        </li>
        {pageWindow(page, pages).map((n, i) =>
          n === null ? (
            <li key={`gap-${i}`} aria-hidden="true" className="text-muted-foreground px-1">
              …
            </li>
          ) : (
            <li key={n}>
              {n === page ? (
                <span aria-current="page" className={current}>
                  <span aria-hidden="true">{n}</span>
                  <span className="sr-only">{t("currentPage", { page: n })}</span>
                </span>
              ) : (
                <Link
                  href={href(n)}
                  rel={rel()}
                  className={idle}
                  aria-label={t("goToPage", { page: n })}
                >
                  {n}
                </Link>
              )}
            </li>
          ),
        )}
        <li>
          {page < pages ? (
            <Link href={href(page + 1)} rel={rel("next")} className={idle}>
              <span className="sr-only sm:not-sr-only">{t("next")}</span>
              <ChevronRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
            </Link>
          ) : (
            <span aria-disabled="true" className={disabled}>
              <span className="sr-only sm:not-sr-only">{t("next")}</span>
              <ChevronRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
            </span>
          )}
        </li>
      </ul>
      <p className="text-small text-muted-foreground">{t("status", { page, pages })}</p>
    </nav>
  );
}
