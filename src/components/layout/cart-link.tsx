"use client";

import { ShoppingCart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { routes } from "@/config/routes";
import { selectCartCount, useCartStore } from "@/features/cart/store";
import { Link } from "@/i18n/navigation";
import { headerIconLink } from "./header-styles";

const MAX_BADGE = 99;

/** Cart link with a live count badge. The count is read after hydration so server and client markup match. */
export function CartLink() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const [hydrated, setHydrated] = useState(false);
  const count = useCartStore((s) => (hydrated ? selectCartCount(s) : 0));

  useEffect(() => {
    void Promise.resolve(useCartStore.persist.rehydrate()).then(() => setHydrated(true));
    // Keep several open tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cart") void useCartStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const badge = new Intl.NumberFormat(locale, { numberingSystem: "latn" }).format(
    Math.min(count, MAX_BADGE),
  );

  return (
    <Link
      href={routes.cart}
      aria-label={t("cartCount", { count })}
      className={`${headerIconLink} inline-flex`}
    >
      <span className="relative inline-flex">
        <ShoppingCart aria-hidden="true" className="size-6" />
        {count > 0 ? (
          <span
            aria-hidden="true"
            data-testid="cart-badge"
            className="bg-primary text-primary-foreground absolute -end-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs leading-none font-bold tabular-nums"
          >
            {count > MAX_BADGE ? `${badge}+` : badge}
          </span>
        ) : null}
      </span>
      <span aria-hidden="true" className="text-small hidden font-semibold xl:inline">
        {t("cart")}
      </span>
    </Link>
  );
}
