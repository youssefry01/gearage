import type { Metadata } from "next";
import { hasLocale, useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return pageMetadata(locale);
}

export default function HomePage() {
  const t = useTranslations("Home");
  return (
    <>
      {/* Temporary chrome; the real header, mega-menu and footer arrive in M1b. */}
      <header className="max-w-page px-gutter mx-auto flex w-full flex-wrap items-center justify-between gap-3 py-4">
        <LanguageSwitcher />
        <ThemeToggle />
      </header>
      <main
        id="main"
        className="max-w-page px-gutter mx-auto flex w-full flex-1 flex-col justify-center gap-8 py-12"
      >
        <h1>
          <Logo variant="stacked" priority className="w-64 max-w-full sm:w-80" />
        </h1>
        <p className="text-heading max-w-prose text-balance">{t("lead")}</p>
        <p className="text-muted-foreground max-w-prose text-pretty">{t("status")}</p>
      </main>
    </>
  );
}
