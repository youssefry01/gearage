import type { Metadata } from "next";
import { hasLocale, useLocale, useTranslations } from "next-intl";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/layout/coming-soon";
import {
  allCategoryTrails,
  categoryName,
  categoryPath,
  findCategory,
} from "@/features/navigation/categories";
import type { Locale } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string[] }> };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => allCategoryTrails().map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const found = findCategory(slug);
  if (!hasLocale(routing.locales, locale) || !found) return {};
  const title = categoryName(found.node, locale);
  return {
    title,
    robots: { index: false, follow: true }, // placeholder until the catalog ships (M3a)
    ...pageMetadata(locale, { path: categoryPath(slug), title }),
  };
}

function CategoryPage({ slug }: { slug: string[] }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("ComingSoon");
  const crumbsT = useTranslations("Breadcrumb");
  const found = findCategory(slug);
  if (!found) notFound();
  const crumbs = [
    { label: crumbsT("home"), href: "/" },
    ...found.chain.map((c, i) => ({
      label: categoryName(c, locale),
      href: categoryPath(found.chain.slice(0, i + 1).map((n) => n.slug)),
    })),
  ];
  return (
    <ComingSoon title={categoryName(found.node, locale)} body={t("categoryBody")} crumbs={crumbs} />
  );
}

export default async function CategoryRoute({ params }: Props) {
  const { slug } = await params;
  if (!findCategory(slug)) notFound();
  return <CategoryPage slug={slug} />;
}
