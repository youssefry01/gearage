import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { accountRoutes } from "@/config/routes";
import { accountMetadata } from "@/features/account/account-metadata";
import { RevertEmailChangeForm } from "@/features/account/revert-email-change-form";
import { AuthShell } from "@/features/auth/auth-shell";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale)
    ? accountMetadata(locale, "revertEmailChange", accountRoutes.revertEmailChange)
    : {};
}

/** Public on purpose: the person reading the old mailbox may be on another device. Static; the token is in the fragment. */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Account.revertEmailChange" });
  return (
    <AuthShell title={t("title")} intro={t("intro")}>
      <RevertEmailChangeForm />
    </AuthShell>
  );
}
