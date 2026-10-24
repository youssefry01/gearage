import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/json-ld";
import { siteUrl } from "@/lib/site-url";

export type Crumb = { label: string; href?: string };

/**
 * Visual breadcrumb trail plus its BreadcrumbList JSON-LD. The last crumb is the current page; pass `currentPath`
 * (locale-less, no query string) so structured data carries its canonical URL.
 */
export function Breadcrumbs({ items, currentPath }: { items: Crumb[]; currentPath?: string }) {
  const t = useTranslations("Breadcrumb");
  const locale = useLocale();
  const origin = siteUrl().origin;
  const ld = breadcrumbJsonLd(
    items.map((item, i) => {
      const path = i === items.length - 1 ? (currentPath ?? item.href) : item.href;
      return {
        name: item.label,
        ...(path === undefined ? {} : { url: `${origin}/${locale}${path === "/" ? "" : path}` }),
      };
    }),
  );
  return (
    <nav aria-label={t("label")}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ld) }}
      />
      <ol className="text-small text-muted-foreground flex flex-wrap items-center">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="inline-flex items-center">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="rounded-control hover:text-foreground inline-flex min-h-11 min-w-11 items-center"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "text-foreground font-medium" : ""}
                >
                  {item.label}
                </span>
              )}
              {last ? null : (
                <ChevronRight
                  aria-hidden="true"
                  className="mx-1 size-4 shrink-0 rtl:-scale-x-100"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
