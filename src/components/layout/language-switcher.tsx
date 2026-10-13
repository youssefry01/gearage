import { locales, nativeNameOf } from "@/i18n/locales";
import { LanguageLinks } from "./language-links";

/** Server wrapper: names are resolved on the server so server and client markup always agree. */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  return (
    <LanguageLinks
      compact={compact}
      options={locales.map((locale) => ({ locale, name: nativeNameOf(locale) }))}
    />
  );
}
