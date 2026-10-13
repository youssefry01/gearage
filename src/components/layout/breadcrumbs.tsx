import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export type Crumb = { label: string; href?: string };

/** Visual breadcrumb trail. The last crumb is the current page. (BreadcrumbList JSON-LD joins in M3b.) */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = useTranslations("Breadcrumb");
  return (
    <nav aria-label={t("label")}>
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
