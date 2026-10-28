import { CircleAlert, CircleCheck, CircleX, ImageOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { cardSavings } from "@/domain/listing";
import { formatPrice } from "@/domain/money";
import { stockLevel } from "@/domain/stock";
import type { Locale } from "@/i18n/locales";
import { productHref } from "@/domain/catalog";
import { Link } from "@/i18n/navigation";
import { CompareToggle } from "@/features/compare/compare-toggle";
import { toCompareItem } from "@/features/compare/item";
import type { ProductCardData } from "@/server/services/listing.service";

/** Storefront URL of a product. The page itself ships in M3b; the shape is decided there (HANDOFF). */
export { productHref };

const IMAGE_SIZES =
  "(min-width: 1280px) 22vw, (min-width: 1024px) 24vw, (min-width: 768px) 30vw, 48vw";

/**
 * One product in a listing. A single link (the title) is stretched over the whole card, so there is exactly one tab
 * stop per product and no nested interactive elements. Everything shown comes from the database row: the compare-at
 * price and "you save" are only displayed when they are real numbers on the product, never invented.
 */
export function ProductCard({
  product,
  priority = false,
  showCompare = false,
}: {
  product: ProductCardData;
  priority?: boolean;
  /** Offer the "Compare" checkbox (listings, search and related products; not the home shelves). */
  showCompare?: boolean;
}) {
  const t = useTranslations("ProductCard");
  const locale = useLocale() as Locale;
  const title = product.title[locale];
  const savings = cardSavings(product);
  const level = stockLevel(product.available, product.lowStockThreshold);
  const isBundle = product.type === "BUNDLE";
  const money = (amount: number) => formatPrice(amount, locale);
  const compareItem = showCompare ? toCompareItem(product) : null;

  return (
    <article
      className="group border-border bg-card text-card-foreground rounded-panel duration-fast hover:border-primary focus-within:border-primary relative flex h-full flex-col overflow-hidden border transition-colors"
      data-testid="product-card"
    >
      <div className="bg-muted relative aspect-square">
        {product.image ? (
          <Image
            src={product.image.url}
            alt={product.image.alt[locale]}
            fill
            sizes={IMAGE_SIZES}
            priority={priority}
            // Seed placeholders are local SVGs, which the optimizer does not process. Real raster images are optimized.
            unoptimized={product.image.url.endsWith(".svg")}
            className={`duration-base object-contain p-3 transition-transform group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${level === "out" ? "opacity-60" : ""}`}
          />
        ) : (
          <div
            role="img"
            aria-label={t("noImage")}
            className="text-muted-foreground flex size-full items-center justify-center"
          >
            <ImageOff aria-hidden="true" className="size-8" />
          </div>
        )}
        {savings?.kind === "compare-at" ? (
          <span className="rounded-control bg-primary text-small text-primary-foreground absolute start-2 top-2 px-2 py-1 font-semibold">
            {t("percentOff", { percent: savings.percent })}
          </span>
        ) : null}
        {isBundle ? (
          <span className="rounded-control bg-secondary text-small text-secondary-foreground border-input absolute end-2 top-2 border px-2 py-1 font-semibold">
            {t("bundle")}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.brand ? (
          <p className="text-small text-muted-foreground truncate">{product.brand.name[locale]}</p>
        ) : null}
        <h3 className="font-medium">
          <Link
            href={productHref(product.slug)}
            className="rounded-control flex min-h-11 items-center after:absolute after:inset-0 focus-visible:outline-none"
          >
            {/* The link box is at least 44px tall even for a one-line title (wide cards); the clamp is inside it. */}
            <span className="line-clamp-3 break-words">{title}</span>
          </Link>
        </h3>
        {isBundle ? (
          <p className="text-small text-muted-foreground">
            {t("parts", { count: product.componentCount })}
          </p>
        ) : null}

        <div className="mt-auto flex flex-col gap-1 pt-2">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="sr-only">{t("currentPrice")}</span>
            <bdi className="text-heading font-bold">{money(product.effectivePrice)}</bdi>
            {savings?.kind === "compare-at" && product.compareAtPrice !== null ? (
              <span className="text-small text-muted-foreground line-through">
                <span className="sr-only">
                  {t("wasPrice", { price: money(product.compareAtPrice) })}
                </span>
                <bdi aria-hidden="true">{money(product.compareAtPrice)}</bdi>
              </span>
            ) : null}
          </p>
          {savings?.kind === "bundle" ? (
            <p className="text-small text-success font-medium">
              {t("youSave", { amount: money(savings.amount) })}{" "}
              <span className="text-muted-foreground font-normal">{t("vsParts")}</span>
            </p>
          ) : null}
          {level === "out" ? (
            <p className="text-small text-danger inline-flex items-center gap-1 font-medium">
              <CircleX aria-hidden="true" className="size-4 shrink-0" />
              {t("outOfStock")}
            </p>
          ) : level === "low" ? (
            <p className="text-small text-warning inline-flex items-center gap-1 font-medium">
              <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
              {t("lowStock", { count: product.available ?? 0 })}
            </p>
          ) : product.available !== null ? (
            <p className="text-small text-success inline-flex items-center gap-1 font-medium">
              <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
              {t("inStock")}
            </p>
          ) : null}
        </div>
        {compareItem ? <CompareToggle item={compareItem} /> : null}
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  eager = 4,
}: {
  products: readonly ProductCardData[];
  eager?: number;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id} className="min-w-0">
          <ProductCard product={p} priority={i < eager} showCompare />
        </li>
      ))}
    </ul>
  );
}
