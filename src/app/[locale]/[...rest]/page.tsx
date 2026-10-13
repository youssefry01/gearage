import type { Metadata } from "next";
import { hasLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/layout/coming-soon";
import {
  PLACEHOLDER_ROUTES,
  routeKeyForPath,
  routes,
  type PlaceholderRouteKey,
} from "@/config/routes";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; rest: string[] }> };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    PLACEHOLDER_ROUTES.map((key) => ({ locale, rest: routes[key].slice(1).split("/") })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, rest } = await params;
  const key = routeKeyForPath(rest.join("/"));
  if (!hasLocale(routing.locales, locale) || !key) return {};
  const t = await getTranslations({ locale, namespace: "Routes" });
  return {
    title: t(key),
    robots: { index: false, follow: true }, // placeholder until the real page ships
    ...pageMetadata(locale, { path: routes[key], title: t(key) }),
  };
}

function Page({ routeKey }: { routeKey: PlaceholderRouteKey }) {
  const routesT = useTranslations("Routes");
  const t = useTranslations("ComingSoon");
  return <ComingSoon title={routesT(routeKey)} body={t("body")} />;
}

// Known-but-unbuilt routes render "coming soon"; anything else is a real 404 (status 404, localized).
export default async function CatchAllPage({ params }: Props) {
  const { rest } = await params;
  const key = routeKeyForPath(rest.join("/"));
  if (!key) notFound();
  return <Page routeKey={key} />;
}
