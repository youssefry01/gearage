"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/config/routes";
import { compareParam } from "@/domain/compare";
import { ensureCompareHydrated, useCompareStore } from "./store";

/** Removes one product from the comparison: from this device's list AND from the page URL. */
export function RemoveFromCompare({
  slug,
  title,
  remaining,
  differencesOnly,
}: {
  slug: string;
  title: string;
  remaining: string[];
  differencesOnly: boolean;
}) {
  const t = useTranslations("Compare");
  const router = useRouter();
  const onClick = async () => {
    await ensureCompareHydrated();
    useCompareStore.getState().remove(slug);
    const query = new URLSearchParams();
    if (remaining.length > 0) query.set("p", compareParam(remaining));
    if (differencesOnly && remaining.length > 0) query.set("diff", "1");
    const qs = query.toString().replaceAll("%2C", ",");
    router.replace(qs ? `${routes.compare}?${qs}` : routes.compare);
  };
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      data-testid="compare-remove"
      className="text-small text-link hover:text-link-hover rounded-control inline-flex min-h-11 w-fit items-center gap-1 underline underline-offset-4"
    >
      <X aria-hidden="true" className="size-4" />
      {t("removeFromList", { title })}
    </button>
  );
}
