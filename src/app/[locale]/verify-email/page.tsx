import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routes } from "@/config/routes";
import { CODE_EXPIRES_MINUTES, emailSchema } from "@/domain/auth";
import { AuthShell } from "@/features/auth/auth-shell";
import { authMetadata } from "@/features/auth/auth-metadata";
import { VerifyForm } from "@/features/auth/verify-form";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale)
    ? authMetadata(locale, "verify", routes.verifyEmail)
    : {};
}

export default async function VerifyEmailPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const sp = await searchParams;
  const parsed = emailSchema.safeParse(Array.isArray(sp["email"]) ? sp["email"][0] : sp["email"]);
  // Without a usable address there is nothing to verify: start from the sign-in page, which sends unverified accounts back here.
  if (!parsed.success) redirect({ href: routes.login, locale });
  const email = parsed.success ? parsed.data : "";
  const t = await getTranslations({ locale, namespace: "Auth.verify" });
  return (
    <AuthShell
      title={t("title")}
      intro={t("intro", { email, minutes: CODE_EXPIRES_MINUTES })}
      footer={
        <Link
          href={routes.register}
          className="text-link inline-flex min-h-11 items-center underline"
        >
          {t("wrongEmail")}
        </Link>
      }
    >
      <VerifyForm email={email} />
    </AuthShell>
  );
}
