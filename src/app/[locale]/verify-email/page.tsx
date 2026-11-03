import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routes } from "@/config/routes";
import { CODE_EXPIRES_MINUTES } from "@/domain/auth";
import { AuthShell } from "@/features/auth/auth-shell";
import { authMetadata } from "@/features/auth/auth-metadata";
import { VerifyForm } from "@/features/auth/verify-form";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPendingEmail } from "@/server/auth/pending";

/** Reads a per-visitor cookie: never static (ADR 0024). */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale)
    ? authMetadata(locale, "verify", routes.verifyEmail)
    : {};
}

export default async function VerifyEmailPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // The address comes from the signed cookie set by register/login, not from the URL. Without one there is nothing to
  // verify: start from the sign-in page, which sends unverified accounts back here.
  const email = await getPendingEmail();
  if (!email) redirect({ href: routes.login, locale });
  const t = await getTranslations({ locale, namespace: "Auth.verify" });
  const linkClass = "text-link inline-flex min-h-11 items-center underline";
  return (
    <AuthShell
      title={t("title")}
      intro={t("intro", { email: email ?? "", minutes: CODE_EXPIRES_MINUTES })}
      footer={
        <span className="flex flex-col">
          <Link href={routes.login} className={linkClass}>
            {t("signIn")}
          </Link>
          <Link href={routes.forgotPassword} className={linkClass}>
            {t("forgot")}
          </Link>
          <Link href={routes.register} className={linkClass}>
            {t("wrongEmail")}
          </Link>
        </span>
      }
    >
      <VerifyForm />
    </AuthShell>
  );
}
