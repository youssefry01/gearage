import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { buttonStyles } from "@/components/ui/button";
import { cardSavings } from "@/domain/listing";
import { formatPrice } from "@/domain/money";
import { productHref } from "@/domain/catalog";
import type { Locale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import type { HeroBundle } from "@/server/services/home.service";

/** Parts listed in the hero panel; the rest is summarized as "+N more" (the bundle page lists them all). */
const MAX_PARTS_SHOWN = 6;

/**
 * The featured bundle as a parts list, the way PC builds are actually written down. Every number comes from the
 * database row (price and parts total are the bundle views); nothing here is invented. The grid sits only behind the
 * image, never behind text, so contrast is always measured against a solid surface.
 */
function BundlePanel({ hero }: { hero: HeroBundle }) {
  const t = useTranslations("Home");
  const card = useTranslations("ProductCard");
  const locale = useLocale() as Locale;
  const { product, parts } = hero;
  const savings = cardSavings(product);
  const shown = parts.slice(0, MAX_PARTS_SHOWN);
  const more = parts.length - shown.length;
  const titleId = "hero-bundle-title";

  return (
    <aside
      aria-labelledby={titleId}
      className="border-border bg-card text-card-foreground rounded-panel flex flex-col overflow-hidden border"
      data-testid="hero-bundle"
    >
      {product.image ? (
        <div className="bg-measure bg-muted relative aspect-[2/1]">
          <Image
            src={product.image.url}
            alt={product.image.alt[locale]}
            fill
            priority
            sizes="(min-width: 1024px) 40vw, 100vw"
            unoptimized={product.image.url.endsWith(".svg")}
            className="object-contain p-4"
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-1">
          <p className="text-small text-muted-foreground flex flex-wrap gap-x-3">
            <span>{t("bundleLabel")}</span>
            <span>{t("bundleParts", { count: parts.length })}</span>
          </p>
          <h2 id={titleId} className="text-heading font-semibold text-balance">
            {product.title[locale]}
          </h2>
        </div>

        <ul className="border-border divide-border divide-y border-y">
          {shown.map((part, i) => (
            <li key={i} className="text-small flex items-baseline gap-3 py-2">
              <span className="text-muted-foreground w-6 shrink-0 text-end tabular-nums">
                {part.quantity}×
              </span>
              <bdi className="min-w-0 flex-1">{part.title[locale]}</bdi>
            </li>
          ))}
          {more > 0 ? (
            <li className="text-small text-muted-foreground py-2 ps-9">
              {t("bundleMore", { count: more })}
            </li>
          ) : null}
        </ul>

        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="flex flex-col">
            <p>
              <span className="sr-only">{card("currentPrice")}</span>
              <bdi className="text-heading font-bold">
                {formatPrice(product.effectivePrice, locale)}
              </bdi>
            </p>
            {savings?.kind === "bundle" ? (
              <p className="text-small text-success font-medium">
                {card("youSave", { amount: formatPrice(savings.amount, locale) })}{" "}
                <span className="text-muted-foreground font-normal">{card("vsParts")}</span>
              </p>
            ) : null}
          </div>
          <Link href={productHref(product.slug)} className={buttonStyles({ variant: "primary" })}>
            {t("bundleView")}
            <span className="sr-only"> {product.title[locale]}</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}

export function Hero({ hero, hasDeals }: { hero: HeroBundle | null; hasDeals: boolean }) {
  const t = useTranslations("Home");
  return (
    <section
      aria-labelledby="home-title"
      className={`grid items-center gap-8 lg:gap-12 ${hero ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" : ""}`}
    >
      <div className="flex flex-col gap-5">
        <h1
          id="home-title"
          className="text-display tracking-display max-w-[18ch] font-bold text-balance"
        >
          {t("heroTitle")}
        </h1>
        <p className="text-muted-foreground max-w-prose text-pretty">{t("heroLead")}</p>
        <div className="flex flex-wrap gap-3">
          <a href="#categories" className={buttonStyles({ variant: "primary" })}>
            {t("ctaCategories")}
          </a>
          {hasDeals ? (
            <a href="#deals" className={buttonStyles({ variant: "secondary" })}>
              {t("ctaDeals")}
            </a>
          ) : null}
        </div>
      </div>
      {hero ? <BundlePanel hero={hero} /> : null}
    </section>
  );
}
