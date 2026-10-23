import { useLocale, useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { brand, localized, storeName } from "@/config/brand";
import { routes, type PlaceholderRouteKey } from "@/config/routes";
import type { ContactSettings } from "@/domain/store-settings";
import { type CategoryNode, categoryName } from "@/domain/category-tree";
import { categoryPath } from "@/features/navigation/href";
import type { Locale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import { CookieSettingsButton } from "./cookie-settings-button";
import { StatusDot } from "./status-dot";

const link =
  "inline-flex min-h-11 min-w-11 items-center rounded-control text-muted-foreground transition-colors duration-fast hover:text-foreground";
const heading = "text-small font-semibold tracking-wide text-foreground uppercase";

const CARE: PlaceholderRouteKey[] = [
  "shipping",
  "returns",
  "warranty",
  "faq",
  "contact",
  "branches",
];
const COMPANY: PlaceholderRouteKey[] = ["about", "terms", "privacy", "cookies"];
const SOCIAL = [
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["x", "X"],
  ["youtube", "YouTube"],
  ["tiktok", "TikTok"],
  ["linkedin", "LinkedIn"],
] as const;

export function SiteFooter({
  contact,
  categoryTree,
}: {
  contact: ContactSettings;
  categoryTree: readonly CategoryNode[];
}) {
  const t = useTranslations("Footer");
  const nav = useTranslations("Nav");
  const routeTitle = useTranslations("Routes");
  const locale = useLocale() as Locale;
  const address = contact.address[locale] ?? contact.address["en"];
  const whatsappDigits = contact.whatsapp?.replace(/\D/g, "");
  const socials = SOCIAL.filter(([key]) => contact.social[key]);

  return (
    <footer className="border-border bg-card text-small mt-auto border-t">
      <div className="max-w-page px-gutter mx-auto grid grid-cols-2 gap-x-6 gap-y-10 py-12 sm:grid-cols-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="col-span-2 flex flex-col gap-4 sm:col-span-3 lg:col-span-1">
          <Link href="/" className="rounded-control inline-flex min-h-11 w-fit items-center">
            <Logo variant="inline" className="w-40" sizes="10rem" />
          </Link>
          <p className="text-muted-foreground max-w-xs">{localized(brand.tagline, locale)}</p>
          <ul className="text-muted-foreground flex flex-col">
            {contact.email ? (
              <li>
                <a href={`mailto:${contact.email}`} className={link}>
                  <span className="sr-only">{t("email")}: </span>
                  {contact.email}
                </a>
              </li>
            ) : null}
            {contact.phone ? (
              <li>
                <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`} className={link}>
                  <span className="sr-only">{t("phone")}: </span>
                  <span dir="ltr">{contact.phone}</span>
                </a>
              </li>
            ) : null}
            {whatsappDigits ? (
              <li>
                <a
                  href={`https://wa.me/${whatsappDigits}`}
                  className={link}
                  rel="noopener noreferrer"
                >
                  {t("whatsapp")}
                </a>
              </li>
            ) : null}
            {address ? (
              <li className="py-2">
                <span className="sr-only">{t("address")}: </span>
                {address}
              </li>
            ) : null}
          </ul>
          {socials.length > 0 ? (
            <nav aria-label={t("followUs")}>
              <ul className="flex flex-wrap gap-x-4">
                {socials.map(([key, name]) => (
                  <li key={key}>
                    <a
                      href={contact.social[key] ?? undefined}
                      className={link}
                      rel="noopener noreferrer"
                    >
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>

        <nav aria-labelledby="footer-shop">
          <h2 id="footer-shop" className={heading}>
            {t("shop")}
          </h2>
          <ul className="mt-2">
            {categoryTree.map((c) => (
              <li key={c.slug}>
                <Link href={categoryPath([c.slug])} className={link}>
                  {categoryName(c, locale)}
                </Link>
              </li>
            ))}
            <li>
              <Link href={routes.deals} className={link}>
                {nav("deals")}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-care">
          <h2 id="footer-care" className={heading}>
            {t("customerCare")}
          </h2>
          <ul className="mt-2">
            {CARE.map((key) => (
              <li key={key}>
                <Link href={routes[key]} className={link}>
                  {routeTitle(key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-company">
          <h2 id="footer-company" className={heading}>
            {t("company")}
          </h2>
          <ul className="mt-2">
            {COMPANY.map((key) => (
              <li key={key}>
                <Link href={routes[key]} className={link}>
                  {routeTitle(key)}
                </Link>
              </li>
            ))}
            <li>
              <CookieSettingsButton className={`${link} cursor-pointer`} />
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-border border-t">
        <div className="max-w-page px-gutter text-muted-foreground mx-auto flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <p className="text-foreground font-medium">{t("payments")}</p>
            <ul className="flex flex-wrap gap-2">
              <li className="rounded-control border-border border px-3 py-1">{t("payCod")}</li>
              <li className="rounded-control border-border border px-3 py-1">{t("payCard")}</li>
            </ul>
          </div>
          <div className="flex flex-col gap-1 sm:items-end">
            <StatusDot />
            <p>
              {/* <bdi> isolates "© 2026 Brand" so it cannot scramble inside an Arabic sentence. */}
              <bdi>
                {t("copyright", { year: new Date().getFullYear(), brand: storeName(locale) })}
              </bdi>{" "}
              {t("rights")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
