import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ACCOUNT_SECTIONS, type AccountSection } from "@/config/account-sections";
import { LogoutButton } from "@/features/auth/logout-button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/locales";

export type { AccountSection };

/**
 * Frame of every account page (M5b-2b): the page heading and, beside it, one navigation with the sections and Sign out.
 * From lg it is a column to the side of the content that stays below the sticky header while the page scrolls (so Sign out is never hidden under it), with Sign out at its foot; below lg it is a wrapping row of 44px links
 * above the content with Sign out as its last item, so on a 320px phone nothing is hidden behind a scroll. One
 * <nav>, one DOM order (heading, menu, content): the same links in the same order for a keyboard and a screen reader at every width.
 */
export async function AccountShell({
  locale,
  current,
  title,
  intro,
  children,
}: {
  locale: Locale;
  current: AccountSection;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  const t = await getTranslations({ locale, namespace: "Account.nav" });
  return (
    <main
      id="main"
      className="px-gutter max-w-page mx-auto flex w-full flex-1 flex-col gap-6 py-8 sm:py-12 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-x-10 lg:gap-y-6"
    >
      <header className="flex flex-col gap-2 lg:col-start-2 lg:row-start-1">
        <h1 className="text-title font-bold text-balance">{title}</h1>
        {intro ? <p className="text-muted-foreground">{intro}</p> : null}
      </header>
      <nav
        aria-label={t("label")}
        className="lg:sticky lg:top-36 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start [@media(max-height:32rem)]:static"
      >
        <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {ACCOUNT_SECTIONS.map((section) => {
            const active = section.key === current;
            return (
              <li key={section.key}>
                <Link
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  data-testid={`account-nav-${section.key}`}
                  className={
                    "rounded-control duration-fast ease-standard inline-flex min-h-11 min-w-11 items-center justify-center border px-4 py-2 font-semibold transition-colors lg:flex lg:justify-start " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-secondary text-secondary-foreground hover:bg-accent")
                  }
                >
                  {t(section.key)}
                </Link>
              </li>
            );
          })}
          <li className="lg:border-border flex flex-col gap-2 lg:mt-3 lg:border-t lg:pt-3">
            <LogoutButton className="lg:w-full lg:justify-start" />
          </li>
        </ul>
      </nav>
      <div className="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-2">{children}</div>
    </main>
  );
}
