import { CircleAlert, CircleCheck, CircleX, ImageOff, Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { routes } from "@/config/routes";
import { productHref } from "@/domain/catalog";
import { COMPARE_MAX, compareParam, onlyDifferences, type CompareCell } from "@/domain/compare";
import { formatPrice } from "@/domain/money";
import { stockLevel } from "@/domain/stock";
import { DemoNotice } from "@/features/catalog/demo-notice";
import { SpecValue } from "@/features/product/specs-table";
import type { Locale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import type { ComparisonView } from "@/server/services/compare.service";
import { PruneMissing } from "./compare-client";
import { CompareEmptyCard } from "./empty-card";
import { RemoveFromCompare } from "./remove-button";

const ROW_LABEL = {
  price: "rowPrice",
  savings: "rowSavings",
  availability: "rowAvailability",
  brand: "rowBrand",
  model: "rowModel",
  condition: "rowCondition",
  warranty: "rowWarranty",
  memory: "rowMemory",
  storage: "rowStorage",
  psu: "rowPsu",
  compat: "rowCompat",
} as const;

const SECTION_LABEL = {
  overview: "sectionOverview",
  specs: "sectionSpecs",
  parts: "sectionParts",
  summary: "sectionSummary",
} as const;

function Cell({ cell }: { cell: CompareCell }) {
  const t = useTranslations("Compare");
  const locale = useLocale() as Locale;
  const number = new Intl.NumberFormat(locale, {
    numberingSystem: "latn",
    maximumFractionDigits: 2,
  });
  switch (cell.kind) {
    case "none":
      return (
        <span className="text-muted-foreground">
          <span aria-hidden="true">—</span>
          <span className="sr-only">{t("notListed")}</span>
        </span>
      );
    case "spec":
      return <SpecValue display={cell.display} />;
    case "text":
      return <>{cell.text[locale]}</>;
    case "money":
      return <bdi className="font-semibold">{formatPrice(cell.amount, locale)}</bdi>;
    case "number":
      return (
        <bdi>
          {cell.unit === "months"
            ? t("months", { count: cell.value })
            : cell.unit === "gb"
              ? t("gigabytes", { value: number.format(cell.value) })
              : cell.unit === "w"
                ? t("watts", { value: number.format(cell.value) })
                : number.format(cell.value)}
        </bdi>
      );
    case "list":
      return (
        <ul className="flex flex-col gap-1">
          {cell.items.map((i) => (
            <li key={i.en}>{i[locale]}</li>
          ))}
        </ul>
      );
    case "condition":
      return <>{cell.value === "NEW" ? t("conditionNEW") : t("conditionREFURBISHED")}</>;
    case "stock": {
      const level = stockLevel(cell.available, cell.lowStockThreshold);
      const Icon = level === "out" ? CircleX : level === "low" ? CircleAlert : CircleCheck;
      const tone =
        level === "out" ? "text-danger" : level === "low" ? "text-warning" : "text-success";
      return (
        <span className={`${tone} inline-flex items-center gap-1 font-medium`}>
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          {level === "out" ? t("outOfStock") : level === "low" ? t("lowStock") : t("inStock")}
        </span>
      );
    }
    case "compat": {
      const Icon =
        cell.status === "ok" ? CircleCheck : cell.status === "notes" ? CircleAlert : CircleX;
      const tone =
        cell.status === "ok"
          ? "text-success"
          : cell.status === "notes"
            ? "text-warning"
            : "text-danger";
      return (
        <span className={`${tone} inline-flex items-center gap-1 font-medium`}>
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          {cell.status === "ok"
            ? t("compatOk")
            : cell.status === "notes"
              ? t("compatNotes")
              : t("compatProblem")}
        </span>
      );
    }
  }
}

const stickyHead = "bg-card sticky start-0 z-10 w-26 min-w-26 sm:w-44 sm:min-w-44";

/**
 * The comparison page body. Server-rendered from `?p=` so it is shareable and works without JavaScript; only the
 * remove buttons need the client (they also update this device's list). Wide tables scroll INSIDE a focusable
 * region (the page never scrolls sideways) and the first column stays put.
 */
export function CompareBody({
  view,
  differencesOnly,
}: {
  view: ComparisonView;
  differencesOnly: boolean;
}) {
  const t = useTranslations("Compare");
  const crumbsT = useTranslations("Breadcrumb");
  const locale = useLocale() as Locale;
  const slugs = view.columns.map((c) => c.slug);
  const sections = differencesOnly ? onlyDifferences(view.sections) : view.sections;
  const heading =
    view.kind === "bundles"
      ? t("headingBundles")
      : view.categoryName
        ? t("headingParts", { category: view.categoryName[locale] })
        : t("title");
  const toggleHref = `${routes.compare}?p=${compareParam(slugs)}${differencesOnly ? "" : "&diff=1"}`;

  return (
    <main
      id="main"
      className="max-w-page px-gutter mx-auto flex w-full flex-1 flex-col gap-6 py-6 sm:py-8"
    >
      <PruneMissing missing={view.missing} />
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          items={[{ label: crumbsT("home"), href: "/" }, { label: t("title") }]}
          currentPath={routes.compare}
        />
        <DemoNotice />
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-title font-bold text-balance" data-testid="compare-title">
          {heading}
        </h1>
        <p className="text-muted-foreground max-w-prose">{t("lead", { max: COMPARE_MAX })}</p>
      </header>

      {view.missing.length > 0 || view.dropped > 0 || view.truncated ? (
        <div className="flex flex-col gap-2" data-testid="compare-notices">
          {[
            view.missing.length > 0 ? t("missingNotice", { count: view.missing.length }) : null,
            view.dropped > 0 ? t("droppedNotice", { count: view.dropped }) : null,
            view.truncated ? t("truncatedNotice", { max: COMPARE_MAX }) : null,
          ]
            .filter((m): m is string => m !== null)
            .map((m) => (
              <p
                key={m}
                className="border-border bg-card text-small rounded-control flex items-start gap-2 border px-3 py-2"
              >
                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>{m}</span>
              </p>
            ))}
        </div>
      ) : null}

      {view.columns.length === 0 ? <CompareEmptyCard /> : null}
      {view.columns.length === 1 ? <p className="text-muted-foreground">{t("needMore")}</p> : null}

      {view.columns.length >= 2 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-small text-muted-foreground flex items-center gap-2">
            <span aria-hidden="true" className="bg-primary inline-block size-2 rounded-full" />
            {t("legend")}
          </p>
          <Link
            href={toggleHref}
            data-testid="compare-diff-toggle"
            className="text-link hover:text-link-hover rounded-control inline-flex min-h-11 items-center font-medium underline underline-offset-4"
          >
            {differencesOnly ? t("showAll") : t("differencesOnly")}
          </Link>
        </div>
      ) : null}

      {view.columns.length > 0 ? (
        <div
          role="region"
          aria-label={t("tableLabel")}
          tabIndex={0}
          className="border-border rounded-panel relative overflow-x-auto border"
        >
          <table className="w-full border-collapse text-start" data-testid="compare-table">
            <caption className="sr-only">{t("caption")}</caption>
            <thead>
              <tr>
                <td className={`${stickyHead} border-border border-b`} />
                {view.columns.map((c) => {
                  const title = c.title[locale];
                  return (
                    <th
                      key={c.slug}
                      scope="col"
                      data-testid="compare-column"
                      className="border-border w-56 min-w-44 border-s border-b p-3 text-start align-top font-normal"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="bg-muted relative aspect-square w-full max-w-32">
                          {c.image ? (
                            <Image
                              src={c.image.url}
                              alt={c.image.alt[locale]}
                              fill
                              sizes="128px"
                              unoptimized={c.image.isSvg}
                              className="object-contain p-2"
                            />
                          ) : (
                            <ImageOff
                              aria-hidden="true"
                              className="text-muted-foreground absolute inset-0 m-auto size-8"
                            />
                          )}
                        </div>
                        {c.brand ? (
                          <p className="text-small text-muted-foreground">{c.brand[locale]}</p>
                        ) : null}
                        <Link
                          href={productHref(c.slug)}
                          className="rounded-control text-link hover:text-link-hover inline-flex min-h-11 items-center font-medium underline underline-offset-4"
                        >
                          <span className="line-clamp-3 break-words">{title}</span>
                        </Link>
                        <RemoveFromCompare
                          slug={c.slug}
                          title={title}
                          remaining={slugs.filter((s) => s !== c.slug)}
                          differencesOnly={differencesOnly}
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            {sections.map((s) => (
              <tbody key={s.id}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={view.columns.length + 1}
                    className="bg-muted text-small border-border border-b px-3 py-2 text-start font-semibold"
                  >
                    {t(SECTION_LABEL[s.id])}
                  </th>
                </tr>
                {s.rows.map((r) => {
                  const known = r.id in ROW_LABEL;
                  const label =
                    r.label?.[locale] ??
                    (known ? t(ROW_LABEL[r.id as keyof typeof ROW_LABEL]) : r.id);
                  return (
                    <tr
                      key={r.id}
                      data-differs={r.differs ? "true" : "false"}
                      data-testid="compare-row"
                    >
                      <th
                        scope="row"
                        className={`${stickyHead} border-border text-small border-b px-3 py-2 text-start align-top font-normal`}
                      >
                        <span className="flex items-start gap-2">
                          {r.differs ? (
                            <span className="mt-1.5 shrink-0">
                              <span
                                aria-hidden="true"
                                className="bg-primary block size-2 rounded-full"
                              />
                              <span className="sr-only">{t("differs")}: </span>
                            </span>
                          ) : null}
                          <span className="break-words">{label}</span>
                        </span>
                      </th>
                      {r.cells.map((cell, i) => (
                        <td
                          key={view.columns[i]?.slug ?? i}
                          className="border-border border-s border-b px-3 py-2 align-top break-words"
                        >
                          <Cell cell={cell} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      ) : null}
      {differencesOnly && sections.length === 0 && view.columns.length >= 2 ? (
        <p className="text-muted-foreground" data-testid="compare-no-differences">
          {t("noDifferences")}
        </p>
      ) : null}
    </main>
  );
}
