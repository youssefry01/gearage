"use client";

import { useEffect } from "react";
import { ensureRecentHydrated } from "./hydrate";
import { useRecentStore } from "./store";

/**
 * Remembers on THIS device that the shopper looked at a product. Renders nothing. It is rendered only by the product
 * page, which answers 404 for products a shopper cannot see, so a hidden product is never recorded. This is not view
 * counting (that needs the rate limiter, M5a): nothing is sent to the server.
 */
export function RecordView({ slug }: { slug: string }) {
  useEffect(() => {
    void ensureRecentHydrated().then(() => useRecentStore.getState().record(slug));
  }, [slug]);
  return null;
}
