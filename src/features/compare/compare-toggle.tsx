"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CompareItem } from "@/domain/compare-storage";
import type { Locale } from "@/i18n/locales";
import { ensureCompareHydrated, useCompareStore } from "./store";

/**
 * "Compare" checkbox for a card or product page. A checkbox is the right control: it is a persistent on/off choice
 * and screen readers announce its state. The real input is invisible and fills the whole 44px label (the same
 * pattern as the filter checkboxes), so the touch target is the label, with a drawn box beside the text. The
 * product title is part of the accessible name (visually hidden), so a list of cards does not read "Compare,
 * Compare, Compare". Refusals (list full, other category) are shown and announced by the compare tray.
 */
export function CompareToggle({ item }: { item: CompareItem }) {
  const t = useTranslations("Compare");
  const locale = useLocale() as Locale;
  const checked = useCompareStore((s) => s.items.some((i) => i.slug === item.slug));

  const onChange = async () => {
    await ensureCompareHydrated();
    useCompareStore.getState().toggle(item);
  };

  return (
    <label className="text-small rounded-control hover:bg-accent relative z-10 flex min-h-11 w-full cursor-pointer items-center gap-2 px-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => void onChange()}
        className="peer absolute inset-0 size-full cursor-pointer opacity-0"
        data-testid="compare-toggle"
      />
      <span
        aria-hidden="true"
        className="border-input bg-background text-primary-foreground peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline-ring pointer-events-none flex size-5 shrink-0 items-center justify-center rounded-[0.25rem] border-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-checked:[&_svg]:opacity-100"
      >
        <Check className="size-3.5 opacity-0" strokeWidth={3} />
      </span>
      <span className="pointer-events-none">
        {t("toggle")}
        <span className="sr-only"> {item.title[locale]}</span>
      </span>
    </label>
  );
}
