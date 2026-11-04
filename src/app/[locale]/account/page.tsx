import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { accountRoutes, routes } from "@/config/routes";
import { AccountShell } from "@/features/account/account-shell";
import { requireSession } from "@/features/account/require-session";
import { authMetadata } from "@/features/auth/auth-metadata";
import { LogoutButton } from "@/features/auth/logout-button";
import { buttonStyles } from "@/components/ui/button";
import { toLocalMobile } from "@/domain/auth";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getProfile } from "@/server/services/account.service";

/** Per-visitor page: it reads the session cookie, so it is never prerendered or cached (ADR 0024). */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale) ? authMetadata(locale, "account", routes.account) : {};
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await requireSession(locale, routes.account);
  const profile = await getProfile(session.user.id);
  const t = await getTranslations({ locale, namespace: "Auth.account" });
  const o = await getTranslations({ locale, namespace: "Account.overview" });

  return (
    <AccountShell locale={locale} current="overview" title={t("title")}>
      <section className="border-border bg-card rounded-panel flex flex-col gap-4 border p-5 sm:p-6">
        <p className="text-lg font-semibold" data-testid="account-hello">
          {t("hello", { name: profile.firstName })}
        </p>
        <h2 className="sr-only">{o("detailsHeading")}</h2>
        <dl className="text-small grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted-foreground">{o("name")}</dt>
          <dd className="break-words">
            {profile.firstName} {profile.lastName}
          </dd>
          <dt className="text-muted-foreground">{o("email")}</dt>
          <dd dir="ltr" className="text-start break-all">
            {profile.email}
          </dd>
          <dt className="text-muted-foreground">{o("phone")}</dt>
          <dd dir="ltr" className="text-start">
            {toLocalMobile(profile.phone)}
          </dd>
        </dl>
        <p className="text-small text-muted-foreground">{t("signedInNote")}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="border-border bg-card rounded-panel flex flex-col gap-3 border p-5">
          <h2 className="text-heading font-semibold text-balance">{o("profileTitle")}</h2>
          <p className="text-small text-muted-foreground">{o("profileBody")}</p>
          <Link
            href={accountRoutes.profile}
            className={`${buttonStyles({ variant: "secondary" })} self-start`}
          >
            {o("profileLink")}
          </Link>
        </section>
        <section className="border-border bg-card rounded-panel flex flex-col gap-3 border p-5">
          <h2 className="text-heading font-semibold text-balance">{o("securityTitle")}</h2>
          <p className="text-small text-muted-foreground">{o("securityBody")}</p>
          <Link
            href={accountRoutes.security}
            className={`${buttonStyles({ variant: "secondary" })} self-start`}
          >
            {o("securityLink")}
          </Link>
        </section>
      </div>

      <div>
        <LogoutButton />
      </div>
    </AccountShell>
  );
}
