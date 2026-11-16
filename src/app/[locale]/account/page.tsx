import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { accountRoutes, routes } from "@/config/routes";
import { AccountShell } from "@/features/account/account-shell";
import { requireSession } from "@/features/account/require-session";
import { authMetadata } from "@/features/auth/auth-metadata";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getProfile, listSessions } from "@/server/services/account.service";

/** Per-visitor page: it reads the session cookie, so it is never prerendered or cached (ADR 0024). */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale) ? authMetadata(locale, "account", routes.account) : {};
}

/**
 * A short summary, not a second copy of the profile: who is signed in (the one place the address is shown here) and a
 * card per section with what is worth knowing at a glance. Details live on their own pages (M5b-2b).
 */
export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await requireSession(locale, routes.account);
  const [profile, sessions] = await Promise.all([
    getProfile(session.user.id),
    listSessions(session.user.id, session.sessionId),
  ]);
  const t = await getTranslations({ locale, namespace: "Auth.account" });
  const o = await getTranslations({ locale, namespace: "Account.overview" });

  const card = "border-border bg-card rounded-panel flex flex-col gap-3 border p-5";
  return (
    <AccountShell locale={locale} current="overview" title={t("title")}>
      <section className="border-border bg-card rounded-panel flex flex-col gap-1 border p-5 sm:p-6">
        <p className="text-lg font-semibold" data-testid="account-hello">
          {t("hello", { name: profile.firstName })}
        </p>
        <p className="text-small text-muted-foreground">
          {o.rich("signedInAs", {
            email: () => (
              <bdi dir="ltr" translate="no" className="text-foreground break-all">
                {profile.email}
              </bdi>
            ),
          })}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="overview-profile" className={card}>
          <h2 id="overview-profile" className="text-heading font-semibold text-balance">
            {o("profileTitle")}
          </h2>
          <p className="text-small text-muted-foreground">{o("profileBody")}</p>
          <Link
            href={accountRoutes.profile}
            className={`${buttonStyles({ variant: "secondary" })} self-start`}
          >
            {o("profileLink")}
          </Link>
        </section>
        <section aria-labelledby="overview-security" className={card}>
          <h2 id="overview-security" className="text-heading font-semibold text-balance">
            {o("securityTitle")}
          </h2>
          <p className="text-small text-muted-foreground" data-testid="overview-devices">
            {o("securityBody", { count: sessions.length })}
          </p>
          <Link
            href={accountRoutes.security}
            className={`${buttonStyles({ variant: "secondary" })} self-start`}
          >
            {o("securityLink")}
          </Link>
        </section>
      </div>
    </AccountShell>
  );
}
