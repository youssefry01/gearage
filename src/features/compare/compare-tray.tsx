"use client";

import { ImageOff, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { buttonStyles } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { COMPARE_MAX, compareParam } from "@/domain/compare";
import type { Locale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import { useCompareStore } from "./store";

/**
 * The compare tray: a bar that sticks to the bottom of the screen while the shopper has products selected. It sits
 * AFTER the footer in the page flow, so at the end of a page it never covers content. A visually hidden live region
 * (always present, so the first change is announced too) reports the count and any refusal.
 */
export function CompareTray() {
  const t = useTranslations("Compare");
  const locale = useLocale() as Locale;
  const items = useCompareStore((s) => s.items);
  const notice = useCompareStore((s) => s.notice);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    void Promise.resolve(useCompareStore.persist.rehydrate());
    // Keep several open tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "compare") void useCompareStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // A sticky bar must never cover the element that has keyboard focus: while the bar is shown, reserve its height
  // as scroll padding so the browser scrolls a focused element clear of it.
  const shown = items.length > 0;
  useEffect(() => {
    const bar = barRef.current;
    const root = document.documentElement;
    if (!shown || !bar) return;
    const sync = () => {
      root.style.scrollPaddingBottom = `${bar.offsetHeight}px`;
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty("scroll-padding-bottom");
    };
  }, [shown]);

  const noticeText =
    notice?.kind === "full"
      ? t("trayFull", { max: COMPARE_MAX })
      : notice?.kind === "mismatch"
        ? t("trayMismatch")
        : null;
  const canOpen = items.length >= 2;
  const href = `${routes.compare}?p=${compareParam(items.map((i) => i.slug))}`;

  return (
    <>
      <div role="status" className="sr-only">
        {noticeText ?? (items.length > 0 ? t("trayCount", { count: items.length }) : "")}
      </div>
      {items.length > 0 ? (
        <section
          ref={barRef}
          aria-label={t("trayLabel")}
          data-testid="compare-tray"
          className="border-border bg-card text-card-foreground sticky bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)]"
        >
          <div className="max-w-page px-gutter mx-auto flex flex-col gap-1 py-2">
            {noticeText ? (
              <p className="text-small text-warning flex items-start justify-between gap-2">
                <span className="py-2">{noticeText}</span>
                <button
                  type="button"
                  onClick={() => useCompareStore.getState().dismissNotice()}
                  aria-label={t("trayDismiss")}
                  className="rounded-control grid size-11 shrink-0 place-items-center"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <ul className="flex items-center gap-2">
                {items.map((item) => (
                  <li key={item.slug}>
                    <button
                      type="button"
                      onClick={() => useCompareStore.getState().remove(item.slug)}
                      aria-label={t("trayRemove", { title: item.title[locale] })}
                      data-testid="compare-tray-remove"
                      className="rounded-control border-border bg-muted relative size-11 border"
                    >
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt=""
                          fill
                          sizes="44px"
                          unoptimized={item.image.endsWith(".svg")}
                          className="rounded-control object-contain p-1"
                        />
                      ) : (
                        <ImageOff
                          aria-hidden="true"
                          className="text-muted-foreground absolute inset-0 m-auto size-5"
                        />
                      )}
                      <X
                        aria-hidden="true"
                        className="bg-foreground text-background absolute -end-1 -top-1 size-4 rounded-full p-0.5"
                      />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-small text-muted-foreground" aria-hidden="true">
                {t("trayCount", { count: items.length })}
              </p>
              <div className="ms-auto flex items-center gap-2">
                {canOpen ? (
                  <Link href={href} className={buttonStyles()} data-testid="compare-open">
                    {t("trayOpen")}
                  </Link>
                ) : (
                  <span className="text-small text-muted-foreground">{t("trayNeedMore")}</span>
                )}
                <button
                  type="button"
                  onClick={() => useCompareStore.getState().clear()}
                  className={buttonStyles({ variant: "ghost" })}
                >
                  {t("trayClear")}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
