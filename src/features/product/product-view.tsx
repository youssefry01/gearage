import { useLocale, useTranslations } from "next-intl";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { categoryHref } from "@/domain/category-tree";
import { productHref } from "@/domain/catalog";
import { formatPrice } from "@/domain/money";
import { DemoNotice } from "@/features/catalog/demo-notice";
import { ProductGrid } from "@/features/catalog/product-card";
import { CompareToggle } from "@/features/compare/compare-toggle";
import { toCompareItem } from "@/features/compare/item";
import { RecentlyViewed } from "@/features/recently-viewed/recently-viewed";
import { RecordView } from "@/features/recently-viewed/record-view";
import type { Locale } from "@/i18n/locales";
import { isDemoCatalog } from "@/lib/demo-catalog";
import { productJsonLd, serializeJsonLd } from "@/lib/json-ld";
import { siteUrl } from "@/lib/site-url";
import type { ProductPage } from "@/server/services/product.service";
import { AddToCart } from "./add-to-cart";
import { BundleSection } from "./bundle-section";
import { ProductGallery } from "./gallery";
import { Showcase } from "./showcase";
import { GeneralFacts, SpecsTable } from "./specs-table";
import { StockStatus } from "./stock-status";

const absolute = (origin: string, url: string) =>
  /^https?:\/\//.test(url) ? url : `${origin}${url}`;

export function ProductView({ product }: { product: ProductPage }) {
  const t = useTranslations("Product");
  const card = useTranslations("ProductCard");
  const crumbsT = useTranslations("Breadcrumb");
  const locale = useLocale() as Locale;
  const money = (n: number) => formatPrice(n, locale);
  const isBundle = product.type === "BUNDLE";
  const title = product.title[locale];
  const origin = siteUrl().origin;
  const path = productHref(product.slug);
  const compareItem = toCompareItem({ ...product, image: product.images[0] ?? null });

  const crumbs = [
    { label: crumbsT("home"), href: "/" },
    ...product.trail.map((c) => ({ label: c.name[locale], href: categoryHref(c.path) })),
    { label: title },
  ];

  // Structured data. While the catalog is the illustrative demo seed, the Offer is left out: sample prices must not
  // be published to search engines as facts. Search engines also ignore SVG, so only raster images are listed.
  const ld = productJsonLd({
    name: title,
    description: (product.description ?? product.shortDescription)?.[locale] ?? null,
    url: `${origin}/${locale}${path}`,
    images: product.images.filter((i) => !i.isSvg).map((i) => absolute(origin, i.url)),
    sku: product.sku,
    mpn: product.mpn,
    brandName: product.brand?.name[locale] ?? null,
    condition: product.condition,
    offer: isDemoCatalog() ? null : { price: product.price, available: product.available },
    inLanguage: locale,
  });

  const savings = product.savings;
  const description = product.description?.[locale];
  const short = product.shortDescription?.[locale];

  return (
    <main
      id="main"
      className="max-w-page px-gutter mx-auto flex w-full flex-1 flex-col gap-10 py-6 sm:py-8"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ld) }}
      />
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={crumbs} currentPath={path} />
        <DemoNotice />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <div className="lg:sticky lg:top-24">
          <ProductGallery images={product.images} title={title} />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <header className="flex flex-col gap-2">
            {product.brand ? (
              <p className="text-muted-foreground font-medium">{product.brand.name[locale]}</p>
            ) : null}
            <h1
              className="text-title font-bold text-balance break-words"
              data-testid="product-title"
            >
              {title}
            </h1>
            {isBundle ? (
              <p className="text-small text-muted-foreground">
                {card("bundle")} · {card("parts", { count: product.bundle?.parts.length ?? 0 })}
              </p>
            ) : null}
            {short ? <p className="text-muted-foreground max-w-prose">{short}</p> : null}
          </header>

          <section
            aria-label={t("overview")}
            className="border-border rounded-panel flex flex-col gap-4 border p-4 sm:p-5"
          >
            <div className="flex flex-col gap-1">
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="sr-only">{card("currentPrice")}</span>
                <bdi className="text-heading font-bold" data-testid="product-price">
                  {money(product.price)}
                </bdi>
                {savings?.kind === "compare-at" && product.compareAtPrice !== null ? (
                  <>
                    <span className="text-muted-foreground line-through">
                      <span className="sr-only">
                        {card("wasPrice", { price: money(product.compareAtPrice) })}
                      </span>
                      <bdi aria-hidden="true">{money(product.compareAtPrice)}</bdi>
                    </span>
                    <span className="rounded-control bg-primary text-small text-primary-foreground px-2 py-1 font-semibold">
                      {card("percentOff", { percent: savings.percent })}
                    </span>
                  </>
                ) : null}
              </p>
              {savings ? (
                <p className="text-success font-medium" data-testid="product-savings">
                  {card("youSave", { amount: money(savings.amount) })}
                  {savings.kind === "bundle" ? (
                    <span className="text-muted-foreground font-normal"> {card("vsParts")}</span>
                  ) : null}
                </p>
              ) : null}
            </div>

            <StockStatus
              available={product.available}
              lowStockThreshold={product.lowStockThreshold}
            />
            <AddToCart productId={product.id} available={product.available} />
            {compareItem ? <CompareToggle item={compareItem} /> : null}

            <div className="border-border text-small flex flex-col gap-2 border-t pt-4">
              {!isBundle && product.warrantyMonths > 0 ? (
                <p>
                  <span className="font-medium">{t("warrantyLabel")}:</span>{" "}
                  {t("warranty", { months: product.warrantyMonths })}
                </p>
              ) : null}
              <p>
                <span className="font-medium">{t("deliveryTitle")}:</span> {t("deliveryBody")}
              </p>
            </div>
          </section>

          {product.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label={t("tags")}>
              {product.tags.map((tag) => (
                <li
                  key={tag.slug}
                  className="rounded-control bg-secondary text-small text-secondary-foreground px-3 py-1"
                >
                  {tag.name[locale]}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {product.bundle ? (
        <BundleSection
          bundle={product.bundle}
          price={product.price}
          listTotal={product.listTotal}
          available={product.available}
        />
      ) : null}

      {description ? (
        <section aria-labelledby="description-heading" className="flex flex-col gap-3">
          <h2 id="description-heading" className="text-title font-bold">
            {t("description")}
          </h2>
          <p className="max-w-prose whitespace-pre-line">{description}</p>
        </section>
      ) : null}

      <section aria-labelledby="specs-heading" className="flex flex-col gap-4">
        <h2 id="specs-heading" className="text-title font-bold">
          {t("specifications")}
        </h2>
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <GeneralFacts product={product} />
          {product.specRows.length > 0 ? <SpecsTable rows={product.specRows} /> : null}
        </div>
      </section>

      <Showcase blocks={product.showcase} title={title} />

      {product.includedIn.length > 0 ? (
        <section aria-labelledby="included-heading" className="flex flex-col gap-4">
          <h2 id="included-heading" className="text-title font-bold">
            {t("includedInTitle")}
          </h2>
          <ProductGrid products={product.includedIn} eager={0} />
        </section>
      ) : null}

      {product.related.length > 0 ? (
        <section aria-labelledby="related-heading" className="flex flex-col gap-4">
          <h2 id="related-heading" className="text-title font-bold">
            {t("relatedTitle")}
          </h2>
          <ProductGrid products={product.related} eager={0} />
        </section>
      ) : null}

      <RecordView slug={product.slug} />
      <RecentlyViewed exceptSlug={product.slug} />
    </main>
  );
}
