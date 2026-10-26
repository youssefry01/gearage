import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { railViewAllQuery } from "@/domain/home";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

/**
 * "Deals" is a view of the results page (everything on sale, biggest discount first, in stock: the same selection as
 * the home page's Deals rail), not a page of its own. A temporary redirect, so a dedicated deals landing page can
 * replace it later without browsers having cached a permanent one.
 */
export default async function DealsRoute({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  redirect(`/${locale}${routes.search}${railViewAllQuery("deals")}`);
}
