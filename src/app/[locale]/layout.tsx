import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { CompareTray } from "@/features/compare/compare-tray";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCategoryTree } from "@/server/services/category.service";
import { SkipLink } from "@/components/layout/skip-link";
import { ThemeScript } from "@/components/layout/theme-script";
import { ThemeSync } from "@/components/layout/theme-sync";
import { localized, storeName, brand } from "@/config/brand";
import { themeColors } from "@/design/tokens";
import { directionOf } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import { openGraphFor } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";
import { resolveTopBarLines } from "@/domain/store-settings";
import { getContactSettings, getTopBarSettings } from "@/server/services/store-settings.service";

// Self-hosted fonts via @fontsource (no Google request at build or runtime). Arabic glyphs load only when used.
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-500.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-700.css";
import "@/styles/globals.css";

/**
 * Pages under this layout are statically generated and refreshed hourly (ISR), which also refreshes the contact and
 * social details read below. Admin edits revalidate sooner in M11.
 */
export const revalidate = 3600;

type LayoutProps = { children: React.ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: themeColors.dark },
    { media: "(prefers-color-scheme: light)", color: themeColors.light },
  ],
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const name = storeName(locale);
  const title = localized(brand.seo.title, locale);
  const description = localized(brand.seo.description, locale);
  return {
    metadataBase: siteUrl(),
    applicationName: name,
    title: { default: `${name} | ${title}`, template: `%s | ${name}` },
    description,
    openGraph: openGraphFor(locale),
    twitter: { card: "summary_large_image", images: [brand.ogImage.src] },
    // Canonical and hreflang are set per page via lib/seo.ts#localeAlternates, never here.
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [contact, topBar, categoryTree] = await Promise.all([
    getContactSettings(),
    getTopBarSettings(),
    getCategoryTree(),
  ]);

  return (
    // No data-theme prop here on purpose (see lib/theme.ts): ThemeScript sets it before paint; CSS defaults to dark.
    <html lang={locale} dir={directionOf(locale)} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <NextIntlClientProvider>
          <ThemeSync />
          <SkipLink />
          <SiteHeader
            supportPhone={contact.phone}
            topBarLines={resolveTopBarLines(topBar, locale)}
            categoryTree={categoryTree}
          />
          {children}
          <SiteFooter contact={contact} categoryTree={categoryTree} />
          <CompareTray />
          <CookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
