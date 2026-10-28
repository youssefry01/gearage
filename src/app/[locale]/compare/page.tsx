import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { routes } from "@/config/routes";
import { parseCompareParam } from "@/domain/compare";
import { CompareFromDevice } from "@/features/compare/compare-client";
import { CompareBody } from "@/features/compare/compare-view";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { getComparison } from "@/server/services/compare.service";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Dynamic on purpose: the products live in the URL (`?p=slug,slug`), prices and stock are read per request.

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Compare" });
  const title = t("title");
  return {
    title,
    ...pageMetadata(locale, { title, description: t("metaDescription"), path: routes.compare }),
    // Personal, query-driven page: not indexed, no hreflang cluster, canonical is the bare path.
    alternates: { canonical: `/${locale}${routes.compare}` },
    robots: { index: false, follow: true },
  };
}

export default async function CompareRoute({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const sp = await searchParams;
  const { slugs } = parseCompareParam(sp["p"]);
  if (slugs.length === 0) return <EmptyCompare />;
  const rawP = Array.isArray(sp["p"]) ? sp["p"].join(",") : (sp["p"] ?? "");
  const truncatedInput = parseCompareParam(rawP).truncated;
  const view = await getComparison(slugs);
  const differencesOnly = sp["diff"] === "1";
  return (
    <CompareBody
      view={{ ...view, truncated: view.truncated || truncatedInput }}
      differencesOnly={differencesOnly}
    />
  );
}

async function EmptyCompare() {
  const t = await getTranslations("Compare");
  const crumbs = await getTranslations("Breadcrumb");
  return (
    <main
      id="main"
      className="max-w-page px-gutter mx-auto flex w-full flex-1 flex-col gap-6 py-6 sm:py-8"
    >
      <Breadcrumbs
        items={[{ label: crumbs("home"), href: "/" }, { label: t("title") }]}
        currentPath={routes.compare}
      />
      <h1 className="text-title font-bold">{t("title")}</h1>
      <CompareFromDevice />
    </main>
  );
}
