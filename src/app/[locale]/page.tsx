import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { HomeView } from "@/features/home/home-view";
import { brand, storeName } from "@/config/brand";
import { routing } from "@/i18n/routing";
import { routes } from "@/config/routes";
import { organizationJsonLd, serializeJsonLd, websiteJsonLd } from "@/lib/json-ld";
import { siteUrl } from "@/lib/site-url";
import { pageMetadata } from "@/lib/seo";
import { getHomeData } from "@/server/services/home.service";

/**
 * Static, refreshed every 5 minutes (ISR) because the rails show stock and prices. Verified against the installed
 * Next docs: `revalidate` as a literal segment config is valid with Cache Components off (this project), and the
 * lowest value across layout (3600) and page wins, so this route regenerates every 300 s (ADR 0018).
 */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return pageMetadata(locale);
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const data = await getHomeData();
  const origin = siteUrl().origin;
  const name = storeName(locale);
  const ld = [
    organizationJsonLd({
      name,
      url: origin,
      logo: `${origin}${brand.logo.icon.onLight.src}`,
    }),
    websiteJsonLd({
      name,
      url: `${origin}/${locale}`,
      inLanguage: locale,
      searchUrlTemplate: `${origin}/${locale}${routes.search}?q={search_term_string}`,
    }),
  ];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ld) }}
      />
      <HomeView data={data} />
    </>
  );
}
