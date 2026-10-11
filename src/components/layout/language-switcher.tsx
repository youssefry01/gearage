import { locales, nativeNameOf } from "@/i18n/locales";
import { LanguageLinks } from "./language-links";

/** Server wrapper: names are resolved on the server so server and client markup always agree. */
export function LanguageSwitcher() {
  return (
    <LanguageLinks options={locales.map((locale) => ({ locale, name: nativeNameOf(locale) }))} />
  );
}
