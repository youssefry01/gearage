"use client";

import { ChevronLeft, ChevronRight, ImageOff, Maximize2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Dialog } from "radix-ui";
import { useState, type KeyboardEvent } from "react";
import type { Locale } from "@/i18n/locales";
import { directionOf } from "@/i18n/locales";
import type { PageImage } from "@/server/services/product.service";

const iconButton =
  "rounded-control bg-background/90 text-foreground border-border hover:bg-accent hover:text-accent-foreground inline-flex size-11 items-center justify-center border shadow-sm disabled:opacity-40";

/**
 * Product images: a main image, a thumbnail strip, and a full-screen viewer (Radix Dialog: focus trap, Escape, focus
 * return) with previous/next buttons and arrow keys. The first image is server-rendered, so the page is complete
 * without JavaScript and the LCP image is not waiting for hydration. Zoom is the viewer, not hover magnification,
 * because that works with touch, keyboard and screen readers alike.
 */
export function ProductGallery({ images, title }: { images: readonly PageImage[]; title: string }) {
  const t = useTranslations("Product");
  const empty = useTranslations("ProductCard");
  const locale = useLocale() as Locale;
  const rtl = directionOf(locale) === "rtl";
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const total = images.length;
  const current = images[index];

  if (!current) {
    return (
      <div
        role="img"
        aria-label={empty("noImage")}
        className="bg-muted text-muted-foreground rounded-panel flex aspect-square w-full items-center justify-center"
      >
        <ImageOff aria-hidden="true" className="size-12" />
      </div>
    );
  }

  const go = (delta: number) => setIndex((i) => (i + delta + total) % total);
  const onViewerKey = (e: KeyboardEvent) => {
    if (total < 2) return;
    // Arrow keys follow what is on screen: in RTL the "next" button sits on the left.
    if (e.key === "ArrowRight") go(rtl ? -1 : 1);
    else if (e.key === "ArrowLeft") go(rtl ? 1 : -1);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div role="group" aria-label={t("galleryLabel")} className="flex flex-col gap-3">
        <div className="bg-muted rounded-panel relative aspect-square overflow-hidden">
          <Image
            key={current.url}
            src={current.url}
            alt={current.alt[locale]}
            fill
            sizes="(min-width: 1024px) 48vw, 100vw"
            priority={index === 0}
            unoptimized={current.isSvg}
            className="object-contain p-4"
            data-testid="gallery-main"
          />
          {/* A real Dialog.Trigger, so Radix knows where to return focus when the viewer closes. */}
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label={t("enlarge")}
              className={`${iconButton} absolute end-2 top-2`}
            >
              <Maximize2 aria-hidden="true" className="size-5" />
            </button>
          </Dialog.Trigger>
        </div>

        {total > 1 ? (
          <ul className="flex gap-2 overflow-x-auto pb-1" aria-label={t("galleryLabel")}>
            {images.map((img, i) => (
              <li key={img.url} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={t("showImage", { number: i + 1, total })}
                  aria-current={i === index ? "true" : undefined}
                  className={`bg-muted rounded-control relative block size-16 overflow-hidden border-2 sm:size-20 ${i === index ? "border-primary" : "hover:border-input border-transparent"}`}
                >
                  <Image
                    src={img.url}
                    alt=""
                    fill
                    sizes="80px"
                    unoptimized={img.isSvg}
                    className="object-contain p-1"
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <Dialog.Portal>
          <Dialog.Overlay className="data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in fixed inset-0 z-50 bg-black/80" />
          <Dialog.Content
            onKeyDown={onViewerKey}
            className="bg-background text-foreground fixed inset-2 z-50 flex flex-col rounded-lg shadow-xl focus:outline-none sm:inset-6"
          >
            <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-2">
              <Dialog.Title className="text-heading truncate font-semibold">
                {t("viewerTitle", { title })}
              </Dialog.Title>
              <Dialog.Close aria-label={t("close")} className={iconButton}>
                <X aria-hidden="true" className="size-6" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">{t("viewerDescription")}</Dialog.Description>
            <div className="bg-muted relative min-h-0 flex-1">
              <Image
                src={current.url}
                alt={current.alt[locale]}
                fill
                sizes="100vw"
                unoptimized={current.isSvg}
                className="object-contain p-4"
              />
              {total > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label={t("previous")}
                    className={`${iconButton} absolute start-2 top-1/2 -translate-y-1/2`}
                  >
                    <ChevronLeft aria-hidden="true" className="size-6 rtl:-scale-x-100" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label={t("next")}
                    className={`${iconButton} absolute end-2 top-1/2 -translate-y-1/2`}
                  >
                    <ChevronRight aria-hidden="true" className="size-6 rtl:-scale-x-100" />
                  </button>
                </>
              ) : null}
            </div>
            <p role="status" className="text-small text-muted-foreground px-4 py-2 text-center">
              {t("imageCounter", { current: index + 1, total })}
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </div>
    </Dialog.Root>
  );
}
