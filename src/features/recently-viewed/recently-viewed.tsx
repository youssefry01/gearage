"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { shelfSlugs } from "@/domain/recently-viewed";
import { ProductRail } from "@/features/home/product-rail";
import type { ProductCardData } from "@/server/services/listing.service";
import { ensureRecentHydrated } from "./hydrate";
import { useRecentStore } from "./store";

type CardsResponse = { ok: true; data: { items: ProductCardData[] } } | { ok: false };

/**
 * "Recently viewed" shelf. The list of slugs lives on the device; the cards are fetched fresh (price, stock) from
 * /api/products/cards, so nothing shown is stale or invented. Shows nothing when the list is empty, when the request
 * fails, or when every product has since been hidden (those are dropped from the device list).
 */
export function RecentlyViewed({ exceptSlug }: { exceptSlug?: string }) {
  const t = useTranslations("RecentlyViewed");
  const slugs = useRecentStore((s) => s.slugs);
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<ProductCardData[]>([]);

  useEffect(() => {
    void ensureRecentHydrated().then(() => setHydrated(true));
  }, []);

  const key = hydrated ? shelfSlugs(slugs, exceptSlug).join(",") : "";

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const asked = key.split(",");
    fetch(`/api/products/cards?slugs=${key}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<CardsResponse>) : null))
      .then((body) => {
        if (!body || !body.ok) return;
        setItems(body.data.items);
        // Products that are no longer visible leave the device list (only after a successful answer).
        const back = new Set(body.data.items.map((i) => i.slug));
        const gone = asked.filter((s) => !back.has(s));
        if (gone.length > 0) useRecentStore.getState().removeMany(gone);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [key]);

  // With nothing remembered there is nothing to show, whatever an earlier answer said.
  const visible = key ? items : [];
  if (visible.length === 0) return null;
  return (
    <ProductRail
      id="recently-viewed"
      title={t("title")}
      lead={t("lead")}
      products={visible}
      action={
        <button
          type="button"
          onClick={() => {
            useRecentStore.getState().clear();
            setItems([]);
          }}
          aria-label={t("clearLabel")}
          data-testid="recently-viewed-clear"
          className="text-link hover:text-link-hover rounded-control inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center px-2 font-medium underline underline-offset-4"
        >
          {t("clear")}
        </button>
      }
    />
  );
}
