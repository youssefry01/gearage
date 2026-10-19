import { Banknote, Info, LifeBuoy, Phone, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import type { TopBarIcon, TopBarLine } from "@/domain/store-settings";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

const ICONS: Record<TopBarIcon, LucideIcon> = {
  info: Info,
  truck: Truck,
  banknote: Banknote,
  shield: ShieldCheck,
};

const topLink =
  "inline-flex items-center gap-2 rounded-control py-1 hover:text-foreground min-h-8 pointer-coarse:min-h-11";

/**
 * Slim utility bar (md and up). Start side: information lines from StoreSetting (none by default, so no delivery or
 * payment claim is ever hardcoded), then the support link and phone. End side: language and theme.
 */
export function TopBar({
  supportPhone,
  lines,
}: {
  supportPhone: string | null;
  lines: TopBarLine[];
}) {
  const t = useTranslations("Nav");
  return (
    <div data-topbar className="border-border bg-card hidden border-b md:block">
      <div className="max-w-page px-gutter text-small text-muted-foreground mx-auto flex h-(--topbar-h) items-center justify-between gap-4">
        <ul className="flex min-w-0 items-center gap-5">
          {lines.map((line, i) => {
            const Icon = ICONS[line.icon];
            // The first line shows from md; further lines only from lg, so they never crowd the controls.
            return (
              <li
                key={`${i}-${line.text}`}
                className={`items-center gap-2 ${i === 0 ? "inline-flex" : "hidden lg:inline-flex"}`}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{line.text}</span>
              </li>
            );
          })}
          <li>
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
