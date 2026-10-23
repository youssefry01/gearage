"use client";

import { Check, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useRef } from "react";
import { buttonStyles } from "@/components/ui/button";
import { type ListingFilters, listingQuery, parseListingParams } from "@/domain/listing";
import { formatPrice, fromPounds } from "@/domain/money";
import type { SpecDef } from "@/domain/specs";
import type { Locale } from "@/i18n/locales";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { FacetOption, SpecFacet } from "@/server/services/listing.service";

export type FilterPanelData = {
  filters: ListingFilters;
  /** Only the filterable facets of the category (needed to validate the submitted values). */
  specDefs: SpecDef[];
  brandOptions: FacetOption[];
  tagOptions: FacetOption[];
  specFacets: SpecFacet[];
  priceBounds: { min: number; max: number } | null;
  inStockCount: number;
  onSaleCount: number;
};

const field =
  "rounded-control border-input bg-background text-foreground min-h-11 w-full min-w-0 border px-3";

function Group({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-border border-b py-1">
      <summary className="rounded-control flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          aria-hidden="true"
          className="duration-fast size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="pb-3">{children}</div>
    </details>
  );
}

/**
 * A checkbox whose real <input> is stretched over the whole row (invisible), so the control itself is the full-width,
 * 44px-high hit target and the label text is part of it; the visible box is drawn beside it. Keyboard focus,
 * checked state and screen-reader semantics stay those of a native checkbox.
 */
function Checkbox({
  name,
  value,
  label,
  count,
  checked,
  id,
}: {
  name: string;
  value: string;
  label: string;
  count?: number;
  checked: boolean;
  id: string;
}) {
  return (
    <label
      htmlFor={id}
      className="rounded-control hover:bg-accent relative flex min-h-11 cursor-pointer items-center gap-3 px-1"
    >
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={checked}
        className="peer absolute inset-0 size-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden="true"
        className="border-input bg-background text-primary-foreground peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline-ring pointer-events-none flex size-5 shrink-0 items-center justify-center rounded-[0.25rem] border-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-checked:[&_svg]:opacity-100"
      >
        <Check className="size-3.5 opacity-0" strokeWidth={3} />
      </span>
      <span className="pointer-events-none min-w-0 flex-1 break-words">{label}</span>
      {count === undefined ? null : (
        <span className="text-small text-muted-foreground pointer-events-none tabular-nums">
          {count}
        </span>
      )}
    </label>
  );
}

/**
 * The filter form. It is a real GET <form> (checkbox filters work without JavaScript); with JavaScript the submit
 * is turned into a clean, normalized URL via the same domain functions the server uses, so URLs never carry empty
 * or invalid parameters. `autoApply` (desktop sidebar) applies on every change; the mobile drawer applies on the
 * explicit button instead.
 */
export function FilterPanel({
  data,
  idPrefix,
  autoApply,
  formId,
  onApplied,
}: {
  data: FilterPanelData;
  idPrefix: string;
  autoApply: boolean;
  formId?: string;
  onApplied?: () => void;
}) {
  const t = useTranslations("Filters");
  const list = useTranslations("Listing");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const { filters } = data;

  const apply = (form: HTMLFormElement) => {
    const raw: Record<string, string[]> = {};
    const push = (k: string, v: string) => (raw[k] ??= []).push(v);
    const ranges = new Map<string, { min?: string; max?: string }>();
    for (const [name, value] of new FormData(form).entries()) {
      if (typeof value !== "string" || value.trim() === "") continue;
      const range = /^range\.(.+)\.(min|max)$/.exec(name);
      if (range) {
        const [, key, bound] = range as unknown as [string, string, "min" | "max"];
        ranges.set(key, { ...ranges.get(key), [bound]: value.trim() });
      } else push(name, value.trim());
    }
    for (const [key, r] of ranges) push(`spec.${key}`, `${r.min ?? ""}..${r.max ?? ""}`);
    const next = parseListingParams(raw, data.specDefs); // page is not in the form: back to page 1
    router.push(`${pathname}${listingQuery(next)}`, { scroll: false });
    onApplied?.();
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    apply(e.currentTarget);
  };
  const auto = () => {
    if (autoApply && formRef.current) apply(formRef.current);
  };

  const pounds = (piastres: number | undefined) =>
    piastres === undefined ? "" : String(piastres / 100);
  const boundPounds = (piastres: number | undefined) =>
    piastres === undefined ? undefined : String(Math.floor(piastres / 100));
  const hasSpec = (key: string) => filters.specs[key] !== undefined;
  const id = (...parts: (string | number)[]) => [idPrefix, ...parts].join("-");

  return (
    <form
      ref={formRef}
      id={formId}
      method="get"
      action={pathname}
      onSubmit={onSubmit}
      onChange={(e) => {
        // Checkboxes apply immediately; number boxes wait for blur/Enter so typing is not interrupted.
        if (e.target instanceof HTMLInputElement && e.target.type === "checkbox") auto();
      }}
      onBlur={(e) => {
        if (e.target instanceof HTMLInputElement && e.target.type === "number") auto();
      }}
      key={listingQuery(filters)}
      className="flex flex-col"
    >
      {filters.sort !== "popular" ? <input type="hidden" name="sort" value={filters.sort} /> : null}

      <Group title={t("availability")} defaultOpen>
        <ul>
          <li>
            <Checkbox
              id={id("in_stock")}
              name="in_stock"
              value="1"
              label={t("inStock")}
              count={data.inStockCount}
              checked={filters.inStock}
            />
          </li>
          {data.onSaleCount > 0 || filters.onSale ? (
            <li>
              <Checkbox
                id={id("sale")}
                name="sale"
                value="1"
                label={t("onSale")}
                count={data.onSaleCount}
                checked={filters.onSale}
              />
            </li>
          ) : null}
        </ul>
      </Group>

      {data.priceBounds || filters.priceMin !== undefined || filters.priceMax !== undefined ? (
        <Group title={t("price")} defaultOpen>
          <div className="flex items-center gap-2">
            <label className="min-w-0 flex-1">
              <span className="text-small text-muted-foreground">{t("priceMin")}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                name="price_min"
                defaultValue={pounds(filters.priceMin)}
                placeholder={boundPounds(data.priceBounds?.min)}
                className={field}
              />
            </label>
            <label className="min-w-0 flex-1">
              <span className="text-small text-muted-foreground">{t("priceMax")}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                name="price_max"
                defaultValue={pounds(filters.priceMax)}
                placeholder={
                  data.priceBounds ? String(Math.ceil(data.priceBounds.max / 100)) : undefined
                }
                className={field}
              />
            </label>
          </div>
          {data.priceBounds ? (
            <p className="text-small text-muted-foreground mt-1">
              {t("rangeBetween", {
                min: formatPrice(fromPounds(Math.floor(data.priceBounds.min / 100)), locale),
                max: formatPrice(fromPounds(Math.ceil(data.priceBounds.max / 100)), locale),
              })}
            </p>
          ) : null}
        </Group>
      ) : null}

      {data.brandOptions.length > 0 ? (
        <Group
          title={t("brand")}
          defaultOpen={filters.brands.length > 0 || data.brandOptions.length <= 8}
        >
          <ul className="max-h-72 overflow-y-auto overscroll-contain">
            {data.brandOptions.map((o, i) => (
              <li key={o.value}>
                <Checkbox
                  id={id("brand", i)}
                  name="brand"
                  value={o.value}
                  label={o.label[locale]}
                  count={o.count}
                  checked={o.selected}
                />
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {data.specFacets.map((facet, g) => {
        const title =
          facet.label[locale] + ("unit" in facet && facet.unit ? ` (${facet.unit})` : "");
        if (facet.kind === "checkbox")
          return (
            <Group key={facet.key} title={title} defaultOpen={hasSpec(facet.key) || g < 2}>
              <ul className="max-h-72 overflow-y-auto overscroll-contain">
                {facet.options.map((o, i) => (
                  <li key={o.value}>
                    <Checkbox
                      id={id("spec", facet.key, i)}
                      name={`spec.${facet.key}`}
                      value={o.value}
                      label={o.label[locale]}
                      count={o.count}
                      checked={o.selected}
                    />
                  </li>
                ))}
              </ul>
            </Group>
          );
        if (facet.kind === "toggle")
          return (
            <Group key={facet.key} title={title} defaultOpen={hasSpec(facet.key)}>
              <Checkbox
                id={id("spec", facet.key)}
                name={`spec.${facet.key}`}
                value="1"
                label={facet.label[locale]}
                count={facet.count}
                checked={hasSpec(facet.key)}
              />
            </Group>
          );
        const sel = filters.specs[facet.key];
        return (
          <Group key={facet.key} title={title} defaultOpen={hasSpec(facet.key)}>
            <div className="flex items-center gap-2">
              <label className="min-w-0 flex-1">
                <span className="text-small text-muted-foreground">{t("rangeFrom")}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  name={`range.${facet.key}.min`}
                  defaultValue={sel?.min ?? ""}
                  placeholder={facet.bounds ? String(facet.bounds.min) : undefined}
                  className={field}
                />
              </label>
              <label className="min-w-0 flex-1">
                <span className="text-small text-muted-foreground">{t("rangeTo")}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  name={`range.${facet.key}.max`}
                  defaultValue={sel?.max ?? ""}
                  placeholder={facet.bounds ? String(facet.bounds.max) : undefined}
                  className={field}
                />
              </label>
            </div>
          </Group>
        );
      })}

      {data.tagOptions.length > 0 ? (
        <Group title={t("tags")} defaultOpen={filters.tags.length > 0}>
          <ul className="max-h-72 overflow-y-auto overscroll-contain">
            {data.tagOptions.map((o, i) => (
              <li key={o.value}>
                <Checkbox
                  id={id("tag", i)}
                  name="tag"
                  value={o.value}
                  label={o.label[locale]}
                  count={o.count}
                  checked={o.selected}
                />
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {autoApply ? (
        // Also the only way to apply without JavaScript; harmless (and handy for keyboard users) with it.
        <button type="submit" className={`${buttonStyles({ variant: "secondary" })} mt-4`}>
          {list("showResults")}
        </button>
      ) : null}
    </form>
  );
}

/** "Clear all" link used by the drawer footer and the sidebar. */
export function ClearAllLink({
  href,
  className,
  onClick,
}: {
  href: string;
  className?: string;
  onClick?: () => void;
}) {
  const t = useTranslations("Listing");
  return (
    <Link href={href} onClick={onClick} className={className ?? buttonStyles({ variant: "link" })}>
      {t("clearAll")}
    </Link>
  );
}
