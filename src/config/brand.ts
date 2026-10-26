/**
 * THE one place the store's identity lives. "Gearage" is a working name: nothing else in src/, tests/, scripts/,
 * prisma/ or public/ may contain it (CI: `npm run brand:check`). UI strings use {brand}/{tagline} placeholders in
 * messages/*.json (resolved here), and code reads this config. Colors live in src/design/tokens.ts, and
 * editable contact/social details live in StoreSetting (see server/services/store-settings.service.ts).
 *
 * Renaming the store = edit `name` below, replace the files in public/brand/ (docs/BRAND.md), run `npm run brand:assets`.
 */
import { defaultLocale, type Locale } from "@/i18n/locales";

type Localized = { en: string } & Partial<Record<Locale, string>>;

export type LogoAsset = { src: string; width: number; height: number };
export type LogoVariant = { onDark: LogoAsset; onLight: LogoAsset };

export const brand = {
  /**
   * Machine identifier for INFRASTRUCTURE names derived from the brand (the default test database `<slug>_test`, ...).
   * Lowercase letters and digits only. Changing it after deployment means renaming those resources.
   */
  slug: "gearage",
  /** Store name per locale. Locales without an entry fall back to English. */
  name: { en: "Gearage" } as Localized,
  tagline: {
    en: "PC parts, laptops and bundles.",
    ar: "قطع الكمبيوتر واللابتوب والتجميعات.",
  } as Localized,
  /** Default SEO text. Pages override with their own; these apply when a page has none. */
  seo: {
    title: {
      en: "PC hardware store in Egypt",
      ar: "متجر قطع الكمبيوتر في مصر",
    } as Localized,
    description: {
      en: "Shop CPUs, graphics cards, motherboards, memory, storage, laptops and PC bundles.",
      ar: "تسوّق المعالجات وكروت الشاشة واللوحات الأم والذاكرة والتخزين واللابتوب وتجميعات الكمبيوتر.",
    } as Localized,
  },
  /** Default Open Graph / Twitter image (icon-only logo on the dark surface, derived by `npm run brand:assets`). */
  ogImage: { src: "/brand/og-default.png", width: 1200, height: 630 },
  /**
   * Logo files in public/brand/ (see docs/BRAND.md). "onDark" = light-colored artwork for dark backgrounds,
   * "onLight" = dark-colored artwork for light backgrounds. Dimensions are verified against the files by a unit test.
   */
  logo: {
    inline: {
      onDark: { src: "/brand/logo-inline-on-dark.png", width: 1731, height: 356 },
      onLight: { src: "/brand/logo-inline-on-light.png", width: 1731, height: 356 },
    } satisfies LogoVariant,
    stacked: {
      onDark: { src: "/brand/logo-stacked-on-dark.png", width: 1674, height: 953 },
      onLight: { src: "/brand/logo-stacked-on-light.png", width: 1674, height: 953 },
    } satisfies LogoVariant,
    icon: {
      onDark: { src: "/brand/logo-icon-on-dark.png", width: 1380, height: 1314 },
      onLight: { src: "/brand/logo-icon-on-light.png", width: 1380, height: 1314 },
    } satisfies LogoVariant,
  },
} as const;

export function localized(value: Localized, locale: Locale): string {
  return value[locale] ?? value[defaultLocale] ?? value.en;
}

export const storeName = (locale: Locale): string => localized(brand.name, locale);

/** Variables available to every message as {brand} and {tagline}. */
export function brandVars(locale: Locale): { brand: string; tagline: string } {
  return { brand: storeName(locale), tagline: localized(brand.tagline, locale) };
}

/** Every spelling of the name across locales. Used by the hardcoded-name CI check. */
export function allBrandNames(): string[] {
  return [...new Set(Object.values(brand.name).filter((n): n is string => typeof n === "string"))];
}
