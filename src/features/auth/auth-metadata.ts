import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { brandVars } from "@/config/brand";
import type { Locale } from "@/i18n/locales";
import { pageMetadata } from "@/lib/seo";

/**
 * Metadata for the sign-in family. They are private, per-person pages: not indexed, no hreflang cluster, and
 * `referrer: no-referrer` so a query string (the email on /verify-email) never travels to another site.
 */
export async function authMetadata(
  locale: Locale,
  section: "login" | "register" | "verify" | "account" | "forgot" | "reset",
  path: string,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Auth" });
  const title = t(`${section}.title`);
  return {
    title,
    ...pageMetadata(locale, {
      title,
      description: t(`${section}.metaDescription`, brandVars(locale)),
      path,
    }),
    alternates: { canonical: `/${locale}${path}` },
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}
