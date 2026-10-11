import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { SkipLink } from "@/components/layout/skip-link";
import { ThemeScript } from "@/components/layout/theme-script";
import { localized, storeName, brand } from "@/config/brand";
import { themeColors } from "@/design/tokens";
import { directionOf } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import { openGraphFor } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";

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

  return (
    // data-theme defaults to the brand-native dark theme; ThemeScript applies a saved preference before first paint.
    <html lang={locale} dir={directionOf(locale)} data-theme="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <NextIntlClientProvider>
          <SkipLink />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
