"use client";

import { useEffect } from "react";
import { ensureRecentHydrated } from "./hydrate";
import { useRecentStore } from "./store";

/**
 * Two things when a shopper opens a product page. Renders nothing. It is rendered only by the product page, which
 * answers 404 for products a shopper cannot see, so a hidden product is never recorded.
 * 1. Remembers the product on THIS device (the "recently viewed" shelf; the list never leaves the device).
 * 2. Tells the server one anonymous view happened (ADR 0023): no cookie, no identifier, just the slug. The server
 *    ignores bots and repeat views, and the answer is always 204, so failure is silent and harmless.
 */
export function RecordView({ slug }: { slug: string }) {
  useEffect(() => {
    void ensureRecentHydrated().then(() => useRecentStore.getState().record(slug));
    void fetch("/api/products/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => undefined);
  }, [slug]);
  return null;
}
