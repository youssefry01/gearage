"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { activeFilterCount } from "@/domain/listing";
import { ClearAllLink, FilterPanel, type FilterPanelData } from "./filter-panel";

/** Mobile/tablet filters: a drawer with an explicit apply button (below lg; the sidebar takes over from lg up). */
export function FilterDrawer({ data, clearHref }: { data: FilterPanelData; clearHref: string }) {
  const t = useTranslations("Listing");
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(data.filters);
  const formId = "filters-drawer-form";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={`${buttonStyles({ variant: "secondary" })} lg:hidden`}>
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        {count > 0 ? t("filtersWithCount", { count }) : t("filters")}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="bg-background text-foreground data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in fixed inset-y-0 start-0 z-50 flex w-[min(24rem,92vw)] flex-col shadow-xl focus:outline-none">
          <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-2">
            <Dialog.Title className="text-heading font-semibold">{t("filtersTitle")}</Dialog.Title>
            <Dialog.Close
              aria-label={t("close")}
              className="rounded-control hover:bg-accent hover:text-accent-foreground inline-flex size-11 items-center justify-center"
            >
              <X aria-hidden="true" className="size-6" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t("filtersDescription")}</Dialog.Description>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-2">
            <FilterPanel
              data={data}
              idPrefix="drawer"
              autoApply={false}
              formId={formId}
              onApplied={() => setOpen(false)}
            />
          </div>
          <div className="border-border flex items-center justify-between gap-3 border-t px-4 py-3">
            {count > 0 ? (
              <ClearAllLink href={clearHref} onClick={() => setOpen(false)} />
            ) : (
              <span />
            )}
            <button type="submit" form={formId} className={buttonStyles()}>
              {t("showResults")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
