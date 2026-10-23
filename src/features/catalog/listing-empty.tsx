import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Zero results with the current filters. Offers the way out: clear them (the category itself is never empty here). */
export function ListingEmpty({ clearHref }: { clearHref: string }) {
  const t = useTranslations("Listing");
  return (
    <div
      role="status"
      className="border-border bg-card rounded-panel flex flex-col items-center gap-3 border px-6 py-12 text-center"
    >
      <SearchX aria-hidden="true" className="text-muted-foreground size-10" />
      <h2 className="text-heading font-semibold">{t("noResultsTitle")}</h2>
      <p className="text-muted-foreground max-w-prose">{t("noResultsBody")}</p>
      <Link href={clearHref} className={buttonStyles()}>
        {t("clearFilters")}
      </Link>
    </div>
  );
}
