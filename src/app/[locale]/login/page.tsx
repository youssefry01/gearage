import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routes } from "@/config/routes";
import { safeNextPath } from "@/domain/auth";
import { AuthShell } from "@/features/auth/auth-shell";
import { authMetadata } from "@/features/auth/auth-metadata";
import { LoginForm } from "@/features/auth/login-form";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getSession } from "@/server/auth/session";

/** Per-visitor page: it reads the session cookie, so it is never prerendered or cached (ADR 0024). */
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale) ? authMetadata(locale, "login", routes.login) : {};
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const sp = await searchParams;
  const raw = Array.isArray(sp["next"]) ? sp["next"][0] : sp["next"];
  const next = safeNextPath(raw, routes.account);
  const resetDone = sp["reset"] === "1";
  if (await getSession()) redirect({ href: next, locale });
  const t = await getTranslations({ locale, namespace: "Auth.login" });
  return (
    <AuthShell
      title={t("title")}
      intro={t("intro")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href={routes.register} className="inline-link text-link underline">
            {t("registerLink")}
          </Link>
        </>
      }
    >
      {resetDone ? (
        <p role="status" className="text-small text-success" data-testid="reset-done">
          {t("resetDone")}
        </p>
      ) : null}
      <LoginForm next={next} />
    </AuthShell>
  );
}
