/**
 * The locale registry. Adding a locale = add `messages/<locale>.json` + one entry here (ADR 0006).
 * A test enforces that every entry has a message file with identical keys, and vice versa.
 * Display names come from Intl.DisplayNames and text direction from the language subtag, so no other metadata is needed.
 */
export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

const RTL_LANGUAGES = new Set(["ar", "fa", "he", "ur", "ps", "sd", "ug", "yi", "ckb", "dv"]);

export function directionOf(locale: string): "ltr" | "rtl" {
  const language = locale.split("-")[0] ?? locale;
  return RTL_LANGUAGES.has(language.toLowerCase()) ? "rtl" : "ltr";
}

/** A locale's own name, e.g. "English", "العربية". */
export function nativeNameOf(locale: Locale): string {
  return new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
}

/** Open Graph locale (language_TERRITORY). Falls back to the bare locale for entries not listed. */
const OG_LOCALES: Partial<Record<Locale, string>> = { en: "en_US", ar: "ar_EG" };
export const ogLocaleOf = (locale: Locale): string => OG_LOCALES[locale] ?? locale;
