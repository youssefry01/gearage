import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/layout/coming-soon";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string; slug: string }> };

/** Placeholder so catalog links do not 404 before the real product page (M3b). Never indexed. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "ProductSoon" });
  return { title: t("title"), robots: { index: false, follow: true } };
}

export default async function ProductPlaceholder({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "ProductSoon" });
  return <ComingSoon title={t("title")} body={t("body")} />;
}
