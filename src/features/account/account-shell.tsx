import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { accountRoutes, routes } from "@/config/routes";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/locales";

export type AccountSection = "overview" | "profile" | "security";

const hrefs: Record<AccountSection, string> = {
  overview: routes.account,
  profile: accountRoutes.profile,
  security: accountRoutes.security,
};

/** Frame of every account page: a heading, section links (wrapping, 44px targets, no sideways scroll) and the content. */
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
  const sections: AccountSection[] = ["overview", "profile", "security"];
  return (
    <main
      id="main"
      className="px-gutter mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 py-8 sm:py-14"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-title font-bold text-balance">{title}</h1>
        {intro ? <p className="text-muted-foreground">{intro}</p> : null}
      </header>
      <nav aria-label={t("label")}>
        <ul className="flex flex-wrap gap-2">
          {sections.map((section) => (
            <li key={section}>
              <Link
                href={hrefs[section]}
                aria-current={section === current ? "page" : undefined}
                className={
                  "rounded-control inline-flex min-h-11 min-w-11 items-center justify-center border px-4 py-2 font-semibold transition-colors " +
                  (section === current
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-secondary text-secondary-foreground hover:bg-accent")
                }
              >
                {t(section)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </main>
  );
}
