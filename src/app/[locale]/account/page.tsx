import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routes } from "@/config/routes";
import { AuthShell } from "@/features/auth/auth-shell";
import { authMetadata } from "@/features/auth/auth-metadata";
import { LogoutButton } from "@/features/auth/logout-button";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getSession } from "@/server/auth/session";

/** Per-visitor page: it reads the session cookie, so it is never prerendered or cached (ADR 0024). */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale) ? authMetadata(locale, "account", routes.account) : {};
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await getSession();
  if (!session)
    redirect({ href: `${routes.login}?next=${encodeURIComponent(routes.account)}`, locale });
  const t = await getTranslations({ locale, namespace: "Auth.account" });
  const user = session?.user;
  return (
    <AuthShell title={t("title")}>
      <p className="text-lg font-semibold" data-testid="account-hello">
        {t("hello", { name: user?.firstName ?? "" })}
      </p>
      <dl className="text-small grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted-foreground">{t("email")}</dt>
        <dd dir="ltr" className="break-all">
          {user?.email}
        </dd>
      </dl>
      <p className="text-small text-muted-foreground">{t("signedInNote")}</p>
      <div>
        <LogoutButton />
      </div>
    </AuthShell>
  );
}
