import { useLocale, useTranslations } from "next-intl";
import { dimensionsMm, type SpecDisplay, type SpecRow } from "@/domain/product-page";
import type { Locale } from "@/i18n/locales";
import type { ProductPage } from "@/server/services/product.service";

const th = "text-muted-foreground w-2/5 py-2 pe-4 text-start align-top font-normal sm:w-1/3";
const td = "py-2 text-start align-top break-words";
const tableCls = "border-border divide-border w-full divide-y border-y";

function useNumber() {
  const locale = useLocale();
  // Western digits in both languages (ADR 0006): specs are compared against product boxes and datasheets.
  return new Intl.NumberFormat(locale, { numberingSystem: "latn", maximumFractionDigits: 2 });
}

export function SpecValue({ display }: { display: SpecDisplay }) {
  const t = useTranslations("Product");
  const locale = useLocale() as Locale;
  const number = useNumber();
  switch (display.kind) {
    case "text":
      return <>{display.text[locale]}</>;
    case "number":
      return (
        <bdi>
          {number.format(display.value)}
          {display.unit ? ` ${display.unit}` : ""}
        </bdi>
      );
    case "boolean":
      return <>{display.value ? t("yes") : t("no")}</>;
    case "list":
      return <bdi>{display.items.join(", ")}</bdi>;
  }
}

/** "General" facts (brand, model, SKU, condition, warranty, size) as one table; only facts that exist are listed. */
export function GeneralFacts({ product }: { product: ProductPage }) {
  const t = useTranslations("Product");
  const locale = useLocale() as Locale;
  const number = useNumber();
  const isBundle = product.type === "BUNDLE";
  const dims = dimensionsMm(product.facts);
  const weight = product.facts.weightGrams;
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (product.brand) rows.push({ label: t("brand"), value: product.brand.name[locale] });
  if (product.modelName) rows.push({ label: t("model"), value: <bdi>{product.modelName}</bdi> });
  rows.push({ label: t("sku"), value: <bdi>{product.sku}</bdi> });
  if (product.mpn) rows.push({ label: t("mpn"), value: <bdi>{product.mpn}</bdi> });
  rows.push({ label: t("condition"), value: t(`condition${product.condition}`) });
  // A bundle's warranty is per component (see the parts table); one number would mislead.
  if (!isBundle && product.warrantyMonths > 0)
    rows.push({
      label: t("warrantyLabel"),
      value: t("warranty", { months: product.warrantyMonths }),
    });
  if (!isBundle && weight)
    rows.push({
      label: t("weight"),
      value:
        weight >= 1000
          ? t("kilograms", { value: number.format(weight / 1000) })
          : t("grams", { value: number.format(weight) }),
    });
  if (!isBundle && dims)
    rows.push({
      label: t("dimensions"),
      value: (
        <bdi>
          {t("millimetres", {
            length: number.format(dims.length),
            width: number.format(dims.width),
            height: number.format(dims.height),
          })}
        </bdi>
      ),
    });
  return (
    <table className={tableCls}>
      <caption className="sr-only">{t("general")}</caption>
      <tbody className="divide-border divide-y">
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row" className={th}>
              {r.label}
            </th>
            <td className={td}>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SpecsTable({ rows }: { rows: readonly SpecRow[] }) {
  const t = useTranslations("Product");
  const locale = useLocale() as Locale;
  if (rows.length === 0) return null;
  return (
    <table className={tableCls} data-testid="specs-table">
      <caption className="sr-only">{t("specifications")}</caption>
      <tbody className="divide-border divide-y">
        {rows.map((r) => (
          <tr key={r.key}>
            <th scope="row" className={th}>
              {r.label[locale]}
            </th>
            <td className={td}>
              <SpecValue display={r.display} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
