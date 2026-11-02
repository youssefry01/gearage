import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routes } from "@/config/routes";
import { AuthShell } from "@/features/auth/auth-shell";
import { authMetadata } from "@/features/auth/auth-metadata";
import { RegisterForm } from "@/features/auth/register-form";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getSession } from "@/server/auth/session";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale)
    ? authMetadata(locale, "register", routes.register)
    : {};
}

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (await getSession()) redirect({ href: routes.account, locale });
  const t = await getTranslations({ locale, namespace: "Auth.register" });
  return (
    <AuthShell
      title={t("title")}
      intro={t("intro")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link href={routes.login} className="inline-link text-link underline">
            {t("loginLink")}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
