import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

/**
 * Search is a plain GET form: it works without JavaScript and is a real `search` landmark. Instant suggestions,
 * typo tolerance and Arabic support arrive with M4; the results page is a placeholder until then.
 */
export function HeaderSearch({ className = "" }: { className?: string }) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  return (
    <form
      role="search"
      action={`/${locale}/search`}
      method="get"
      className={`relative ${className}`}
    >
      <label htmlFor="site-search" className="sr-only">
        {t("searchLabel")}
      </label>
      <input
        id="site-search"
        name="q"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        maxLength={120}
        placeholder={t("searchPlaceholder")}
        className="rounded-control border-input bg-card text-foreground placeholder:text-muted-foreground min-h-11 w-full border ps-4 pe-12"
      />
      <button
        type="submit"
        aria-label={t("searchSubmit")}
        className="rounded-e-control text-muted-foreground duration-fast hover:text-foreground absolute inset-y-0 end-0 inline-flex w-11 items-center justify-center transition-colors"
      >
        <Search aria-hidden="true" className="size-5" />
      </button>
    </form>
  );
}
