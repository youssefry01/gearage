"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/locales";

export type LanguageOption = { locale: Locale; name: string };

const SIZE = {
  full: "min-h-11 min-w-11",
  // Dense desktop chrome (top bar): 32px with a fine pointer, still 44px on touch screens.
  compact: "min-h-8 min-w-8 pointer-coarse:min-h-11 pointer-coarse:min-w-11",
} as const;

/** Real links (not buttons): crawlable, middle-clickable, and they carry hreflang. Switching also updates the locale cookie. */
function LanguageLinksInner({
  options,
  compact,
  query,
}: {
  options: LanguageOption[];
  compact: boolean;
  query: string;
}) {
  const t = useTranslations("Common");
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("language")}>
      <ul className="flex gap-1">
        {options.map(({ locale, name }) => (
          <li key={locale}>
            <Link
              href={`${pathname}${query}`}
              locale={locale}
              lang={locale}
              hrefLang={locale}
              aria-current={locale === current ? "true" : undefined}
              className={`${compact ? SIZE.compact : SIZE.full} rounded-control text-small duration-fast ease-standard hover:bg-accent hover:text-accent-foreground aria-[current=true]:bg-secondary aria-[current=true]:text-secondary-foreground inline-flex items-center justify-center px-3 font-medium transition-[background-color,color]`}
            >
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Reads the query string (a filtered listing keeps its filters when the language changes). Needs a Suspense boundary. */
function WithQuery(props: { options: LanguageOption[]; compact: boolean }) {
  const search = useSearchParams().toString();
  return <LanguageLinksInner {...props} query={search ? `?${search}` : ""} />;
}

export function LanguageLinks({
  options,
  compact = false,
}: {
  options: LanguageOption[];
  compact?: boolean;
}) {
  return (
    <Suspense fallback={<LanguageLinksInner options={options} compact={compact} query="" />}>
      <WithQuery options={options} compact={compact} />
    </Suspense>
  );
}
