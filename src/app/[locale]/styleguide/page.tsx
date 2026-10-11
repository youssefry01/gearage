import type { Metadata } from "next";
import { hasLocale, useTranslations } from "next-intl";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button, buttonStyles } from "@/components/ui/button";
import { COLOR_TOKEN_NAMES } from "@/design/tokens";
import { evaluatePairs } from "@/design/evaluate";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Development reference. Hidden (404) in production unless ENABLE_STYLEGUIDE=1 (used by e2e on a production build). */
function enabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_STYLEGUIDE === "1";
}

export default async function StyleguidePage({ params }: { params: Promise<{ locale: string }> }) {
  await connection();
  const { locale } = await params;
  if (!enabled() || !hasLocale(routing.locales, locale)) notFound();
  return <Styleguide />;
}

function Styleguide() {
  const t = useTranslations("Styleguide");
  const results = evaluatePairs();
  const rows = results
    .filter((r) => r.theme === "dark")
    .map((d) => ({
      d,
      l: results.find(
        (r) => r.theme === "light" && r.fg === d.fg && r.bg === d.bg && r.use === d.use,
      ),
    }));

  return (
    <>
      <header className="max-w-page px-gutter mx-auto flex w-full flex-wrap items-center justify-between gap-3 py-4">
        <LanguageSwitcher />
        <ThemeToggle />
      </header>
      <main
        id="main"
        className="max-w-page px-gutter mx-auto flex w-full flex-1 flex-col gap-12 py-8"
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-title font-bold text-balance">{t("title")}</h1>
          <p className="text-muted-foreground max-w-prose">{t("intro")}</p>
        </div>

        <section aria-labelledby="sg-colors" className="flex flex-col gap-4">
          <h2 id="sg-colors" className="text-heading font-semibold">
            {t("colors")}
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
            {COLOR_TOKEN_NAMES.map((name) => (
              <li key={name} className="flex flex-col gap-1">
                <span
                  className="rounded-control border-border h-12 border"
                  style={{ backgroundColor: `var(--${name})` }}
                />
                <code className="text-small">{name}</code>
              </li>
            ))}
          </ul>
          <div className="rounded-panel border-border overflow-x-auto border">
            <table className="text-small w-full min-w-[34rem]">
              <caption className="sr-only">WCAG contrast ratios per token pair</caption>
              <thead className="bg-card text-start">
                <tr>
                  <th scope="col" className="p-2 text-start">
                    Pair
                  </th>
                  <th scope="col" className="p-2 text-start">
                    Use
                  </th>
                  <th scope="col" className="p-2 text-end">
                    Dark
                  </th>
                  <th scope="col" className="p-2 text-end">
                    Light
                  </th>
                  <th scope="col" className="p-2 text-end">
                    Min
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ d, l }) => (
                  <tr key={`${d.fg}-${d.bg}-${d.use}`} className="border-border border-t">
                    <td className="p-2">
                      <code>
                        {d.fg} / {d.bg}
                      </code>
                    </td>
                    <td className="text-muted-foreground p-2">{d.use}</td>
                    <td className="p-2 text-end tabular-nums">{d.ratio.toFixed(2)}</td>
                    <td className="p-2 text-end tabular-nums">{l?.ratio.toFixed(2)}</td>
                    <td className="p-2 text-end tabular-nums">{d.min}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="sg-type" className="flex flex-col gap-4">
          <h2 id="sg-type" className="text-heading font-semibold">
            {t("type")}
          </h2>
          <p className="text-display tracking-display font-bold text-balance">{t("typeSample")}</p>
          <p className="text-title tracking-display font-semibold text-balance">
            {t("typeSample")}
          </p>
          <p className="text-heading font-semibold">{t("typeSample")}</p>
          <p className="text-body max-w-prose">{t("typeSample")}</p>
          <p className="text-small text-muted-foreground max-w-prose">{t("typeSample")}</p>
          <p lang="en" dir="ltr" className="text-heading max-w-prose">
            Ryzen 7 9800X3D, 32 GB DDR5-6000, 1 TB NVMe: EGP 48,500
          </p>
          <p lang="ar" dir="rtl" className="text-heading max-w-prose">
            معالج Ryzen 7 9800X3D مع ذاكرة 32 جيجابايت DDR5 وتخزين 1 تيرابايت: 48,500 جنيه
          </p>
        </section>

        <section aria-labelledby="sg-controls" className="flex flex-col gap-4">
          <h2 id="sg-controls" className="text-heading font-semibold">
            {t("controls")}
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button>{t("primaryAction")}</Button>
            <Button variant="secondary">{t("secondaryAction")}</Button>
            <Button variant="ghost">{t("secondaryAction")}</Button>
            <Button disabled>{t("primaryAction")}</Button>
            <a href="#sg-controls" className={buttonStyles({ variant: "secondary" })}>
              {t("secondaryAction")}
            </a>
          </div>
          <p className="max-w-prose">
            <a
              href="#sg-controls"
              className="inline-link text-link hover:text-link-hover underline underline-offset-4"
            >
              {t("link")}
            </a>
          </p>
          <div className="flex max-w-sm flex-col gap-1">
            <label htmlFor="sg-email" className="font-medium">
              {t("fieldLabel")}
            </label>
            <input
              id="sg-email"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              aria-describedby="sg-email-hint"
              className="rounded-control border-input bg-background text-foreground min-h-11 border px-3"
            />
            <p id="sg-email-hint" className="text-small text-muted-foreground">
              {t("fieldHint")}
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
