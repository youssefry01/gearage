import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { brandVars } from "@/config/brand";
import type { Locale } from "@/i18n/locales";
import { pageMetadata } from "@/lib/seo";

/** Account pages are private: not indexed, no hreflang cluster, no referrer (same rules as the sign-in pages). */
export async function accountMetadata(
  locale: Locale,
  section: "profile" | "security" | "email" | "cancelEmailChange",
  path: string,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: `Account.${section}` });
  const title = t("title");
  return {
    title,
    ...pageMetadata(locale, {
      title,
      description: t("metaDescription", brandVars(locale)),
      path,
    }),
    alternates: { canonical: `/${locale}${path}` },
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}
