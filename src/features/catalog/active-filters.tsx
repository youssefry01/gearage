import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  type Selection,
  activeFilterCount,
  listingQuery,
  withoutSelection,
} from "@/domain/listing";
import { formatPrice } from "@/domain/money";
import type { Locale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import type { ListingView } from "@/server/services/listing.service";

type Chip = { key: string; label: string; selection: Selection };

/** The filters currently applied, each a link that removes just that one (plain links: work without JavaScript). */
export function ActiveFilters({
  view,
  basePath,
  clearHref,
}: {
  view: ListingView;
  basePath: string;
  clearHref: string;
}) {
  const t = useTranslations("Listing");
  const f = useTranslations("Filters");
  const locale = useLocale() as Locale;
  const { filters } = view;
  if (activeFilterCount(filters) === 0) return null;

  const optionLabel = (options: ListingView["brandOptions"], value: string) =>
    options.find((o) => o.value === value)?.label[locale] ?? value;
  const money = (piastres: number) => formatPrice(piastres, locale);
  const chips: Chip[] = [];

  if (filters.inStock)
    chips.push({ key: "in_stock", label: f("inStock"), selection: { type: "in_stock" } });
  if (filters.onSale) chips.push({ key: "sale", label: f("onSale"), selection: { type: "sale" } });
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    const { priceMin: min, priceMax: max } = filters;
    chips.push({
      key: "price",
      label:
        min !== undefined && max !== undefined
          ? t("priceChip", { min: money(min), max: money(max) })
          : min !== undefined
            ? t("priceFrom", { min: money(min) })
            : t("priceUpTo", { max: money(max ?? 0) }),
      selection: { type: "price" },
    });
  }
  for (const b of filters.brands)
    chips.push({
      key: `brand-${b}`,
      label: optionLabel(view.brandOptions, b),
      selection: { type: "brand", value: b },
    });
  for (const tag of filters.tags)
    chips.push({
      key: `tag-${tag}`,
      label: optionLabel(view.tagOptions, tag),
      selection: { type: "tag", value: tag },
    });
  for (const [key, sel] of Object.entries(filters.specs)) {
    const facet = view.specFacets.find((s) => s.key === key);
    const title = facet?.label[locale] ?? key;
    if (sel.values)
      for (const v of sel.values) {
        const label = facet?.kind === "checkbox" ? optionLabel(facet.options, v) : v;
        chips.push({
          key: `spec-${key}-${v}`,
          label: `${title}: ${label}`,
          selection: { type: "spec", key, value: v },
        });
      }
    else if (sel.on)
      chips.push({ key: `spec-${key}`, label: title, selection: { type: "spec", key } });
    else {
      const unit = facet && "unit" in facet && facet.unit ? ` ${facet.unit}` : "";
      chips.push({
        key: `spec-${key}`,
        label: `${title}: ${sel.min ?? ""}–${sel.max ?? ""}${unit}`,
        selection: { type: "spec", key },
      });
    }
  }

  return (
    <section aria-label={t("activeFilters")}>
      <ul className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={`${basePath}${listingQuery(withoutSelection(filters, chip.selection), { page: false })}`}
              aria-label={t("removeFilter", { label: chip.label })}
              className="rounded-control border-input bg-secondary text-secondary-foreground text-small hover:bg-accent inline-flex min-h-11 items-center gap-2 border px-3"
            >
              <span className="break-words">{chip.label}</span>
              <X aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          </li>
        ))}
        {chips.length > 1 ? (
          <li>
            <Link
              href={clearHref}
              className="text-link hover:text-link-hover rounded-control inline-flex min-h-11 items-center px-2 underline underline-offset-4"
            >
              {t("clearAll")}
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
