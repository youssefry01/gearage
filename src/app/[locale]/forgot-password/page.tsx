import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routes } from "@/config/routes";
import { AuthShell } from "@/features/auth/auth-shell";
import { authMetadata } from "@/features/auth/auth-metadata";
import { ForgotForm } from "@/features/auth/forgot-form";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale)
    ? authMetadata(locale, "forgot", routes.forgotPassword)
    : {};
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Auth.forgot" });
  const back = await getTranslations({ locale, namespace: "Auth.forgot" });
  return (
    <AuthShell
      title={t("title")}
      intro={t("intro")}
      footer={
        <Link href={routes.login} className="text-link inline-flex min-h-11 items-center underline">
          {back("back")}
        </Link>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
