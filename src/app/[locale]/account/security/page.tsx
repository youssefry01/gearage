import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { accountRoutes } from "@/config/routes";
import { accountMetadata } from "@/features/account/account-metadata";
import { AccountShell } from "@/features/account/account-shell";
import { ActivityList } from "@/features/account/activity-list";
import { getDevicePatterns } from "@/features/account/device-patterns";
import { PasswordForm } from "@/features/account/password-form";
import { requireSession } from "@/features/account/require-session";
import { SessionsPanel, type SessionItem } from "@/features/account/sessions-panel";
import { describeDevice } from "@/domain/device";
import { routing } from "@/i18n/routing";
import { formatDate, formatDateTime } from "@/lib/format-datetime";
import { listActivity, listSessions } from "@/server/services/account.service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale)
    ? accountMetadata(locale, "security", accountRoutes.security)
    : {};
}

export default async function SecurityPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await requireSession(locale, accountRoutes.security);
  const [t, patterns, sessions, events] = await Promise.all([
    getTranslations({ locale, namespace: "Account.security" }),
    getDevicePatterns(locale),
    listSessions(session.user.id, session.sessionId),
    listActivity(session.user.id),
  ]);

  const items: SessionItem[] = sessions.map((s) => ({
    id: s.id,
    device: describeDevice(s.device, patterns),
    signedIn: formatDateTime(s.signedInAt, locale),
    // Better Auth refreshes this at most once a day, so only the date is shown (not a precise time).
    lastActive: formatDate(s.lastActiveAt, locale),
    current: s.current,
  }));
  const userInputs = [session.user.firstName, session.user.lastName, session.user.email].filter(
    (v) => v.length > 1,
  );

  const card = "border-border bg-card rounded-panel flex flex-col gap-4 border p-5 sm:p-6";
  return (
    <AccountShell locale={locale} current="security" title={t("title")} intro={t("intro")}>
      <section aria-labelledby="pw-heading" className={card}>
        <h2 id="pw-heading" className="text-heading font-semibold text-balance">
          {t("password.heading")}
        </h2>
        <p className="text-small text-muted-foreground">{t("password.intro")}</p>
        <PasswordForm username={session.user.email} userInputs={userInputs} />
      </section>

      <section aria-labelledby="sessions-heading" className={card}>
        <h2 id="sessions-heading" className="text-heading font-semibold text-balance">
          {t("sessions.heading")}
        </h2>
        <p className="text-small text-muted-foreground">{t("sessions.intro")}</p>
        <SessionsPanel sessions={items} />
      </section>

      <section aria-labelledby="activity-heading" className={card}>
        <h2 id="activity-heading" className="text-heading font-semibold text-balance">
          {t("activity.heading")}
        </h2>
        <p className="text-small text-muted-foreground">{t("activity.intro")}</p>
        <ActivityList locale={locale} events={events} devicePatterns={patterns} />
      </section>
    </AccountShell>
  );
}
