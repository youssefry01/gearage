import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { isDemoCatalog } from "@/lib/demo-catalog";

/**
 * Honesty banner: while the catalog is the illustrative seed, no price, discount, stock level or specification on the
 * page may read as a fact. Switched off only by setting CATALOG_DEMO_NOTICE=false at launch (HANDOFF: launch blockers).
 */
export function DemoNotice() {
  const t = useTranslations("Listing");
  if (!isDemoCatalog()) return null;
  return (
    <p className="border-border bg-card text-small text-muted-foreground rounded-control flex items-start gap-2 border px-3 py-2">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{t("demoNotice")}</span>
    </p>
  );
}
