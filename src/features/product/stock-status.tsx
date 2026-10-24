import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { useTranslations } from "next-intl";
import { stockLevel } from "@/domain/stock";

/** Stock line shared by the product page: wording and icon, never colour alone. */
export function StockStatus({
  available,
  lowStockThreshold,
}: {
  available: number | null;
  lowStockThreshold: number;
}) {
  const t = useTranslations("ProductCard");
  const level = stockLevel(available, lowStockThreshold);
  if (level === "out")
    return (
      <p
        className="text-danger inline-flex items-center gap-2 font-medium"
        data-testid="stock-status"
      >
        <CircleX aria-hidden="true" className="size-5 shrink-0" />
        {t("outOfStock")}
      </p>
    );
  if (level === "low")
    return (
      <p
        className="text-warning inline-flex items-center gap-2 font-medium"
        data-testid="stock-status"
      >
        <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
        {t("lowStock", { count: available ?? 0 })}
      </p>
    );
  return (
    <p
      className="text-success inline-flex items-center gap-2 font-medium"
      data-testid="stock-status"
    >
      <CircleCheck aria-hidden="true" className="size-5 shrink-0" />
      {t("inStock")}
    </p>
  );
}
