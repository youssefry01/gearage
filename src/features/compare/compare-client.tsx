"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { routes } from "@/config/routes";
import { compareParam } from "@/domain/compare";
import { useRouter } from "@/i18n/navigation";
import { CompareEmptyCard } from "./empty-card";
import { ensureCompareHydrated, useCompareStore } from "./store";

/** `/compare` with no `?p=`: open the device's list (as a shareable URL), or explain how to start one. */
export function CompareFromDevice() {
  const t = useTranslations("Compare");
  const router = useRouter();
  const [state, setState] = useState<"loading" | "empty">("loading");

  useEffect(() => {
    let cancelled = false;
    void ensureCompareHydrated().then(() => {
      if (cancelled) return;
      const items = useCompareStore.getState().items;
      if (items.length > 0) {
        const diff = new URLSearchParams(window.location.search).get("diff") === "1";
        router.replace(
          `${routes.compare}?p=${compareParam(items.map((i) => i.slug))}${diff ? "&diff=1" : ""}`,
        );
      } else setState("empty");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "loading")
    return (
      <p role="status" className="text-muted-foreground min-h-40" data-testid="compare-loading">
        {t("loading")}
      </p>
    );
  return <CompareEmptyCard />;
}

/** Drops products the server no longer shows (hidden, deleted) from this device's list. Renders nothing. */
export function PruneMissing({ missing }: { missing: string[] }) {
  const key = missing.join(",");
  useEffect(() => {
    if (!key) return;
    void ensureCompareHydrated().then(() => useCompareStore.getState().removeMany(key.split(",")));
  }, [key]);
  return null;
}
