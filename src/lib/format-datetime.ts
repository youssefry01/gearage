import type { Locale } from "@/i18n/locales";

/**
 * Dates in the account area are shown in Egypt's time zone (the store's market) with Western digits in both languages
 * (HANDOFF "Slugs ... Western digits"). `-u-nu-latn` forces the digits; the month names still follow the language.
 * Formatting happens on the server and the finished text is passed to client components, so server and browser can
 * never disagree about a time zone and cause a hydration mismatch.
 */
export const DISPLAY_TIME_ZONE = "Africa/Cairo";

export function formatDateTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
}

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
    dateStyle: "medium",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
}
