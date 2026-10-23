import { Heart, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { routes } from "@/config/routes";
import type { CategoryNode } from "@/domain/category-tree";
import type { TopBarLine } from "@/domain/store-settings";
import type { Locale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import { CartLink } from "./cart-link";
import { headerIconLink } from "./header-styles";
import { HeaderSearch } from "./header-search";
import { LanguageSwitcher } from "./language-switcher";
import { MegaMenu } from "./mega-menu";
import { toMenuTree } from "./menu-tree";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { TopBar } from "./top-bar";

/**
 * Store header. One <header> landmark that is sticky: from md up the slim top bar scrolls away (negative `top` equal
 * to its height) while the main row and category row stay. On short landscape phones it is not sticky at all, so it
 * never eats a third of the screen. Below lg the category row becomes the drawer and search drops to its own row.
 */
export function SiteHeader({
  supportPhone,
  topBarLines,
  categoryTree,
}: {
  supportPhone: string | null;
  topBarLines: TopBarLine[];
  categoryTree: readonly CategoryNode[];
}) {
  const t = useTranslations("Nav");
  const locale = useLocale() as Locale;
  const categories = toMenuTree(categoryTree, locale);

  return (
    <header className="border-border bg-background sticky top-0 z-40 border-b [--topbar-h:2.25rem] md:top-[calc(var(--topbar-h)*-1)] pointer-coarse:[--topbar-h:2.75rem] [@media(max-height:32rem)]:static">
      <TopBar supportPhone={supportPhone} lines={topBarLines} />

      <div className="max-w-page px-gutter mx-auto flex flex-wrap items-center gap-x-2 gap-y-2 py-2 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-x-6 lg:py-3">
        <MobileNav
          categories={categories}
          footer={
            <>
              <LanguageSwitcher />
              <ThemeToggle />
            </>
          }
        />
        <Link href="/" className="rounded-control inline-flex min-h-11 items-center">
          <Logo
            variant="inline"
            preload
            className="w-30 sm:w-36 lg:w-44"
            sizes="(min-width: 1024px) 11rem, (min-width: 640px) 9rem, 7.5rem"
          />
        </Link>
        <HeaderSearch className="order-last basis-full lg:order-none lg:basis-auto" />
        <div className="ms-auto flex items-center gap-1 lg:ms-0">
          <Link href={routes.wishlist} className={`${headerIconLink} hidden sm:inline-flex`}>
            <Heart aria-hidden="true" className="size-6" />
            <span className="xl:text-small sr-only xl:not-sr-only xl:font-semibold">
              {t("wishlist")}
            </span>
          </Link>
          <Link href={routes.account} className={`${headerIconLink} inline-flex`}>
            <User aria-hidden="true" className="size-6" />
            <span className="sr-only xl:not-sr-only xl:flex xl:flex-col xl:text-start xl:leading-tight">
              <span className="text-muted-foreground text-xs">{t("signIn")}</span>
              <span className="text-small font-semibold">{t("account")}</span>
            </span>
          </Link>
          <CartLink />
        </div>
      </div>

      <div className="border-border bg-card hidden border-t lg:block">
        <div className="max-w-page px-gutter mx-auto">
          <MegaMenu categories={categories} />
        </div>
      </div>
    </header>
  );
}
