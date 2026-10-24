import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { categoryHref } from "@/domain/category-tree";
import type { Locale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import type { HomeCategory } from "@/server/services/home.service";

/**
 * Top-level categories from the storefront tree (so an inactive or empty category never gets a tile). The whole tile
 * is the link, which keeps the touch target large; its picture is decorative because the name sits right under it.
 */
export function CategoryTiles({ categories }: { categories: readonly HomeCategory[] }) {
  const t = useTranslations("Home");
  const locale = useLocale() as Locale;
  if (categories.length === 0) return null;
  return (
    <section id="categories" aria-labelledby="categories-title" className="flex flex-col gap-4">
      <h2 id="categories-title" className="text-heading font-semibold">
        {t("categoriesTitle")}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {categories.map((c) => (
          <li key={c.path} className="min-w-0">
            <Link
              href={categoryHref(c.path)}
              data-testid="category-tile"
              className="group border-border bg-card rounded-panel duration-fast hover:border-primary flex h-full flex-col overflow-hidden border transition-colors"
            >
              {c.image ? (
                <span className="bg-muted relative block aspect-[16/9]">
                  <Image
                    src={c.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 48vw"
                    unoptimized={c.image.endsWith(".svg")}
                    className="object-cover object-top"
                  />
                </span>
              ) : null}
              <span className="flex flex-col gap-0.5 p-3">
                <span className="font-semibold">{c.name[locale]}</span>
                <span className="text-small text-muted-foreground">
                  {t("productCount", { count: c.productCount })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
