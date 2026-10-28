import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ProductCardData } from "@/server/services/listing.service";
import { ProductCard } from "@/features/catalog/product-card";

/**
 * A titled row of product cards. Below `lg` it is a swipeable, scroll-snapped row that bleeds to the screen edges
 * (the scroll is inside the list, so the page itself never scrolls sideways); from `lg` it is a 4-column grid.
 * Renders nothing when there is nothing to show: a shelf with a heading and no products is worse than no shelf.
 */
export function ProductRail({
  id,
  title,
  lead,
  products,
  viewAllHref,
  action,
}: {
  id: string;
  title: string;
  lead: string;
  products: readonly ProductCardData[];
  /** Where "View all" goes (the results page, filtered and sorted like this rail). */
  viewAllHref?: string;
  /** Extra control beside the title (the recently viewed shelf puts \"Clear history\" here). */
  action?: React.ReactNode;
}) {
  const t = useTranslations("Home");
  if (products.length === 0) return null;
  const headingId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={headingId} className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={headingId} className="text-heading font-semibold">
            {title}
          </h2>
          <p className="text-small text-muted-foreground">{lead}</p>
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            aria-label={t("viewAllFor", { title })}
            className="text-link hover:text-link-hover rounded-control inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center px-2 font-medium underline underline-offset-4"
          >
            {t("viewAll")}
          </Link>
        ) : null}
        {action}
      </div>
      <ul
        data-testid="product-rail"
        className="-mx-gutter px-gutter scroll-ps-gutter flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:mx-0 lg:grid lg:snap-none lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {products.map((p) => (
          <li
            key={p.id}
            className="w-[46%] max-w-64 min-w-40 shrink-0 snap-start sm:w-[30%] lg:w-auto lg:max-w-none lg:min-w-0"
          >
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
