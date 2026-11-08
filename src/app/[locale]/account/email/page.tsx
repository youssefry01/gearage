import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { accountRoutes } from "@/config/routes";
import { accountMetadata } from "@/features/account/account-metadata";
import { AccountShell } from "@/features/account/account-shell";
import { EmailChangePanel, type PendingView } from "@/features/account/email-change-panel";
import { requireSession } from "@/features/account/require-session";
import { routing } from "@/i18n/routing";
import { formatTime } from "@/lib/format-datetime";
import { getPendingEmailChange } from "@/server/services/email-change.service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale)
    ? accountMetadata(locale, "email", accountRoutes.email)
    : {};
}

export default async function EmailPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await requireSession(locale, accountRoutes.email);
  const [t, pendingRow] = await Promise.all([
    getTranslations({ locale, namespace: "Account.email" }),
    getPendingEmailChange(session.user.id),
  ]);
  const pending: PendingView | null = pendingRow
    ? {
        addressMasked: pendingRow.newEmailMasked,
        until: formatTime(pendingRow.expiresAt, locale),
        attemptsLeft: pendingRow.attemptsLeft,
      }
    : null;

  return (
    <AccountShell locale={locale} current="profile" title={t("title")} intro={t("intro")}>
      <section className="border-border bg-card rounded-panel flex flex-col gap-5 border p-5 sm:p-6">
        <dl className="text-small grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted-foreground">{t("current")}</dt>
          <dd dir="ltr" translate="no" className="text-start break-all" data-testid="current-email">
            {session.user.email}
          </dd>
        </dl>
        <EmailChangePanel pending={pending} />
      </section>
    </AccountShell>
  );
}
