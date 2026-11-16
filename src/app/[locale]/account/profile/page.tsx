import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { accountRoutes } from "@/config/routes";
import { accountMetadata } from "@/features/account/account-metadata";
import { AccountShell } from "@/features/account/account-shell";
import { ProfileForm } from "@/features/account/profile-form";
import { requireSession } from "@/features/account/require-session";
import { toLocalMobile } from "@/domain/auth";
import { routing } from "@/i18n/routing";
import { getProfile } from "@/server/services/account.service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale)
    ? accountMetadata(locale, "profile", accountRoutes.profile)
    : {};
}

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await requireSession(locale, accountRoutes.profile);
  const profile = await getProfile(session.user.id);
  const t = await getTranslations({ locale, namespace: "Account.profile" });

  return (
    <AccountShell locale={locale} current="profile" title={t("title")} intro={t("intro")}>
      <section className="border-border bg-card rounded-panel border p-5 sm:p-6">
        <ProfileForm
          initial={{
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            phone: toLocalMobile(profile.phone),
            dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : "",
            gender: profile.gender ? (profile.gender.toLowerCase() as "male" | "female") : "",
          }}
        />
      </section>
    </AccountShell>
  );
}
