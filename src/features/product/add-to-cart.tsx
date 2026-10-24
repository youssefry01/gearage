"use client";

import { ShoppingCart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { clampQuantity, purchasableLimit } from "@/domain/stock";
import { useCartStore } from "@/features/cart/store";
import { Link } from "@/i18n/navigation";

type Notice = { kind: "added"; count: number } | { kind: "max"; max: number };

/**
 * Quantity picker + add button. The picker offers at most min(stock, per-order cap); adding clamps against what is
 * already in the cart. This is a convenience limit only: stock is re-validated server-side at checkout (M6), a
 * client can never be trusted with it. Outcome is announced in a polite live region.
 */
export function AddToCart({
  productId,
  available,
}: {
  productId: string;
  available: number | null;
}) {
  const t = useTranslations("Product");
  const locale = useLocale();
  const limit = purchasableLimit(available);
  const selectId = useId();
  const [qty, setQty] = useState(1);
  const [notice, setNotice] = useState<Notice | null>(null);
  const number = new Intl.NumberFormat(locale, { numberingSystem: "latn" });

  if (limit === 0) {
    return (
      <button type="button" disabled className={`${buttonStyles({ variant: "secondary" })} w-full`}>
        {t("unavailable")}
      </button>
    );
  }

  const add = async () => {
    // The header's cart link rehydrates the persisted cart on mount; do it here too so a fast click never
    // overwrites what was already saved.
    await Promise.resolve(useCartStore.persist.rehydrate());
    const store = useCartStore.getState();
    const room = limit - (store.lines[productId] ?? 0);
    const toAdd = clampQuantity(qty, room);
    if (toAdd === 0) {
      setNotice({ kind: "max", max: limit });
      return;
    }
    store.add(productId, toAdd);
    setNotice({ kind: "added", count: toAdd });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={selectId} className="text-small text-muted-foreground">
            {t("quantity")}
          </label>
          <select
            id={selectId}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="rounded-control border-input bg-background text-foreground min-h-11 min-w-20 border px-3"
          >
            {Array.from({ length: limit }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {number.format(n)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void add()}
          className={`${buttonStyles()} min-w-48 flex-1`}
          data-testid="add-to-cart"
        >
          <ShoppingCart aria-hidden="true" className="size-5" />
          {t("addToCart")}
        </button>
      </div>
      <p className="text-small text-muted-foreground">
        {t("maxPerOrder", { max: number.format(limit) })}
      </p>
      <p role="status" className="text-small min-h-6 font-medium">
        {notice?.kind === "added" ? (
          <span className="text-success">
            {t("addedToCart", { count: notice.count })}{" "}
            <Link
              href={routes.cart}
              className="text-link hover:text-link-hover underline underline-offset-4"
            >
              {t("viewCart")}
            </Link>
          </span>
        ) : notice?.kind === "max" ? (
          <span className="text-warning">{t("cartMax", { max: notice.max })}</span>
        ) : null}
      </p>
    </div>
  );
}
