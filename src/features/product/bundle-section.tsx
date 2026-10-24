import { CircleAlert, CircleCheck, CircleX, ImageOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { productHref } from "@/domain/catalog";
import { formatPrice } from "@/domain/money";
import type { Locale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import type { BundlePartView, ProductPage } from "@/server/services/product.service";
import { CompatibilityBadge } from "./compat-badge";

type Bundle = NonNullable<ProductPage["bundle"]>;

function PartAvailabilityLabel({ part }: { part: BundlePartView }) {
  const t = useTranslations("Product");
  if (part.availability === "unavailable")
    return (
      <span className="text-danger inline-flex items-center gap-1">
        <CircleX aria-hidden="true" className="size-4 shrink-0" />
        {t("partUnavailable")}
      </span>
    );
  if (part.availability === "short")
    return (
      <span className="text-warning inline-flex items-center gap-1">
        <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
        {t("partShort")}
      </span>
    );
  return (
    <span className="text-success inline-flex items-center gap-1">
      <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
      {t("partOk")}
    </span>
  );
}

function PartThumb({ part }: { part: BundlePartView }) {
  const locale = useLocale() as Locale;
  return (
    <div className="bg-muted rounded-control relative size-12 shrink-0 overflow-hidden">
      {part.image ? (
        <Image
          src={part.image.url}
          alt=""
          fill
          sizes="48px"
          unoptimized={part.image.isSvg}
          className="object-contain p-1"
        />
      ) : (
        <ImageOff
          aria-hidden="true"
          className="text-muted-foreground absolute inset-0 m-auto size-5"
        />
      )}
      <span className="sr-only">{part.image?.alt[locale]}</span>
    </div>
  );
}

/** What a bundle is made of: price comparison, the parts (each linking to its own page), the build summary and the compatibility verdict. */
export function BundleSection({
  bundle,
  price,
  listTotal,
  available,
}: {
  bundle: Bundle;
  price: number;
  listTotal: number;
  available: number | null;
}) {
  const t = useTranslations("Product");
  const compat = useTranslations("Compatibility");
  const locale = useLocale() as Locale;
  const money = (n: number) => formatPrice(n, locale);
  const number = new Intl.NumberFormat(locale, {
    numberingSystem: "latn",
    maximumFractionDigits: 2,
  });
  const { summary, compatibility } = bundle;
  const saving = listTotal > price ? listTotal - price : 0;
  const blocked = available !== null && available <= 0;
  const memory = summary.memoryGb
    ? `${t("gigabytes", { value: number.format(summary.memoryGb) })}${summary.memoryType ? ` ${summary.memoryType}` : ""}`
    : null;
  const storage = summary.storageGb
    ? summary.storageGb >= 1000
      ? t("terabytes", { value: number.format(summary.storageGb / 1000) })
      : t("gigabytes", { value: number.format(summary.storageGb) })
    : null;
  const facts: [string, string][] = [];
  if (memory) facts.push([t("bundleMemory"), memory]);
  if (storage) facts.push([t("bundleStorage"), storage]);
  if (summary.psuWatts)
    facts.push([t("bundlePsu"), t("watts", { value: number.format(summary.psuWatts) })]);
  if (compatibility.estimatedWatts)
    facts.push([
      t("bundleEstimatedDraw"),
      t("watts", { value: number.format(compatibility.estimatedWatts) }),
    ]);
  if (compatibility.recommendedWatts)
    facts.push([
      t("bundleRecommendedPsu"),
      t("watts", { value: number.format(compatibility.recommendedWatts) }),
    ]);

  return (
    <section
      aria-labelledby="bundle-heading"
      className="flex flex-col gap-6"
      data-testid="bundle-section"
    >
      <h2 id="bundle-heading" className="text-title font-bold">
        {t("bundlePartsTitle")}
      </h2>

      {blocked ? (
        <p role="note" className="border-warning rounded-panel text-warning border p-3 font-medium">
          {t("bundleUnavailableNote")}
        </p>
      ) : null}

      <div
        role="region"
        aria-label={t("bundlePartsCaption")}
        tabIndex={0}
        className="border-border rounded-panel overflow-x-auto border"
      >
        <table className="w-full min-w-[34rem] text-start" data-testid="bundle-parts">
          <caption className="sr-only">{t("bundlePartsCaption")}</caption>
          <thead className="bg-muted text-small text-muted-foreground">
            <tr>
              <th scope="col" className="p-3 text-start font-medium">
                {t("colPart")}
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                {t("colQuantity")}
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                {t("colUnitPrice")}
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                {t("colTotal")}
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                {t("colStock")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {bundle.parts.map((part) => (
              <tr key={part.componentId} data-testid="bundle-part">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <PartThumb part={part} />
                    <div className="min-w-0">
                      {part.brand ? (
                        <p className="text-small text-muted-foreground">{part.brand[locale]}</p>
                      ) : null}
                      {part.linkable ? (
                        <Link
                          href={productHref(part.slug)}
                          className="text-link hover:text-link-hover rounded-control inline-block min-h-6 font-medium underline underline-offset-4"
                        >
                          {part.title[locale]}
                        </Link>
                      ) : (
                        <span className="font-medium">{part.title[locale]}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 tabular-nums">{number.format(part.quantity)}</td>
                <td className="p-3 tabular-nums">
                  <bdi>{money(part.unitPrice)}</bdi>
                </td>
                <td className="p-3 tabular-nums">
                  <bdi>{money(part.lineTotal)}</bdi>
                </td>
                <td className="text-small p-3">
                  <PartAvailabilityLabel part={part} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="border-border rounded-panel grid max-w-xl grid-cols-[1fr_auto] gap-x-6 gap-y-2 border p-4">
        <dt className="text-muted-foreground">{t("partsTotal")}</dt>
        <dd className="text-end tabular-nums">
          <bdi data-testid="bundle-parts-total">{money(listTotal)}</bdi>
        </dd>
        <dt className="font-semibold">{t("bundlePrice")}</dt>
        <dd className="text-end font-bold tabular-nums">
          <bdi>{money(price)}</bdi>
        </dd>
        {saving > 0 ? (
          <>
            <dt className="text-success font-medium">{t("saving")}</dt>
            <dd
              className="text-success text-end font-medium tabular-nums"
              data-testid="bundle-saving"
            >
              <bdi>{money(saving)}</bdi>
            </dd>
          </>
        ) : null}
      </dl>

      <div className="grid gap-6 md:grid-cols-2">
        {facts.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-heading font-semibold">{t("bundleSummaryTitle")}</h3>
            <dl className="border-border divide-border divide-y border-y">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-end">
                    <bdi>{value}</bdi>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <h3 className="text-heading font-semibold">{compat("heading")}</h3>
          <CompatibilityBadge report={compatibility} />
        </div>
      </div>
    </section>
  );
}
