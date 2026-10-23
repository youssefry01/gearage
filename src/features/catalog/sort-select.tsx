"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { type ListingFilters, SORTS, type Sort, listingQuery, withSort } from "@/domain/listing";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Native <select>: fully accessible and keyboard friendly everywhere. Changing it returns to page 1. */
export function SortSelect({ filters }: { filters: ListingFilters }) {
  const t = useTranslations("Listing");
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-small text-muted-foreground whitespace-nowrap">
        {t("sortLabel")}
      </label>
      <select
        id={id}
        value={filters.sort}
        lang={locale}
        onChange={(e) => {
          const next = e.target.value as Sort;
          router.push(`${pathname}${listingQuery(withSort(filters, next))}`, { scroll: false });
        }}
        className="rounded-control border-input bg-background text-foreground min-h-11 min-w-0 border px-3"
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {t(`sort.${s}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
