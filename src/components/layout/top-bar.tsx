import { Banknote, LifeBuoy, Phone, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

// NOTE: no display utility here. Items that must hide at small widths set `hidden lg:inline-flex` themselves;
// a shared `inline-flex` would beat `hidden` in the generated CSS.
const info = "items-center gap-2";
const topLink =
  "inline-flex items-center gap-2 rounded-control py-1 hover:text-foreground min-h-8 pointer-coarse:min-h-11";

/** Slim utility bar (md and up): delivery and support info on the start side, language and theme on the end side. */
export function TopBar({ supportPhone }: { supportPhone: string | null }) {
  const t = useTranslations("Nav");
  return (
    <div data-topbar className="border-border bg-card hidden border-b md:block">
      <div className="max-w-page px-gutter text-small text-muted-foreground mx-auto flex h-(--topbar-h) items-center justify-between gap-4">
        <ul className="flex min-w-0 items-center gap-5">
          <li className={`${info} inline-flex`}>
            <Banknote aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{t("codInfo")}</span>
          </li>
          <li className={`${info} hidden lg:inline-flex`}>
            <Truck aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{t("deliveryInfo")}</span>
          </li>
          <li className="hidden xl:block">
            <Link href={routes.contact} className={topLink}>
              <LifeBuoy aria-hidden="true" className="size-4 shrink-0" />
              {t("support")}
            </Link>
          </li>
          {supportPhone ? (
            <li className="hidden xl:block">
              <a href={`tel:${supportPhone.replace(/[^+\d]/g, "")}`} className={topLink}>
                <Phone aria-hidden="true" className="size-4 shrink-0" />
                <span dir="ltr">{supportPhone}</span>
              </a>
            </li>
          ) : null}
        </ul>
        <div className="flex shrink-0 items-center gap-3">
          <LanguageSwitcher compact />
          <ThemeToggle compact />
        </div>
      </div>
    </div>
  );
}
