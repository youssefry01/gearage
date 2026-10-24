import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { cache } from "react";
import { productHref } from "@/domain/catalog";
import { ProductView } from "@/features/product/product-view";
import type { Locale } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { getProductPage } from "@/server/services/product.service";

type Props = { params: Promise<{ locale: string; slug: string }> };

// Dynamic like the listings: stock and price are read per request (a handful of indexed statements, ADR 0017).
// `cache` lets generateMetadata and the page share ONE load per request.
const loadProduct = cache(getProductPage);

const clip = (text: string, max = 160) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const product = await loadProduct(slug);
  if (!product) return {};
  const l = locale as Locale;
  const title = product.seoTitle?.[l] ?? product.title[l];
  const rawDescription =
    product.seoDescription?.[l] ??
    product.shortDescription?.[l] ??
    product.description?.[l] ??
    undefined;
  const description = rawDescription ? clip(rawDescription) : undefined;
  const meta = pageMetadata(l, { title, description, path: productHref(slug) });
  // Social platforms do not render SVG: use the product image only when it is a raster one, else the brand image.
  const raster = product.images.find((i) => !i.isSvg);
  return {
    title,
    ...meta,
    ...(raster && meta.openGraph
      ? { openGraph: { ...meta.openGraph, images: [{ url: raster.url, alt: raster.alt[l] }] } }
      : {}),
  };
}

export default async function ProductRoute({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const product = await loadProduct(slug);
  if (!product) notFound();
  return <ProductView product={product} />;
}
