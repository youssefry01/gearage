import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./locales";

/**
 * Prefix-based routing, always prefixed (/en, /ar). First visit to `/` negotiates Accept-Language, falls back to
 * the default locale and remembers the choice in the NEXT_LOCALE cookie (ADR 0006).
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  localeDetection: true,
});
