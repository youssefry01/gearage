import { useLocale, useTranslations } from "next-intl";
import { categoryHref } from "@/domain/category-tree";
import type { Locale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import type { HomeBrand } from "@/server/services/home.service";

const chip =
  "rounded-control border-input bg-secondary text-secondary-foreground inline-flex min-h-11 min-w-11 items-center gap-2 border px-4";

/**
 * Brands that have visible products, most products first. Names are text, not logos: official logos must come from
 * brand media kits (docs/ASSETS.md), and the seeded wordmark tiles are placeholders that would be unreadable at chip
 * size. There are no brand pages yet, so each chip opens the top-level category where the brand sells most, filtered
 * to that brand (a normal noindex filter URL, ADR 0016).
 */
export function BrandStrip({ brands }: { brands: readonly HomeBrand[] }) {
  const t = useTranslations("Home");
  const locale = useLocale() as Locale;
  if (brands.length === 0) return null;
  return (
    <section aria-labelledby="brands-title" className="flex flex-col gap-4">
      <h2 id="brands-title" className="text-heading font-semibold">
        {t("brandsTitle")}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {brands.map((b) => {
          const name = b.name[locale];
          const body = (
            <>
              <span className="font-medium">{name}</span>
              <span aria-hidden="true" className="text-small text-muted-foreground tabular-nums">
                {b.productCount}
              </span>
              <span className="sr-only">{t("productCount", { count: b.productCount })}</span>
            </>
          );
          return (
            <li key={b.slug}>
              {b.categoryPath ? (
                <Link
                  href={`${categoryHref(b.categoryPath)}?brand=${encodeURIComponent(b.slug)}`}
                  data-testid="brand-chip"
                  className={`${chip} hover:bg-accent`}
                >
                  {body}
                </Link>
              ) : (
                <span className={chip}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
