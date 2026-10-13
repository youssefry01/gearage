"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Accordion, Dialog } from "radix-ui";
import { useState, type ReactNode } from "react";
import { routes } from "@/config/routes";
import { categoryPath } from "@/features/navigation/categories";
import { Link, usePathname } from "@/i18n/navigation";
import type { MenuNode } from "./menu-tree";

const row =
  "flex min-h-11 w-full items-center justify-between gap-2 rounded-control px-3 text-start font-medium hover:bg-accent hover:text-accent-foreground";
const leafLink =
  "flex min-h-11 items-center rounded-control px-3 text-small text-muted-foreground hover:bg-accent hover:text-accent-foreground";

function Chevron() {
  return (
    <ChevronDown
      aria-hidden="true"
      className="duration-fast size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
    />
  );
}

function Branch({ node, trail }: { node: MenuNode; trail: string[] }) {
  const t = useTranslations("Nav");
  const here = [...trail, node.slug];
  if (!node.children) {
    return (
      <Link href={categoryPath(here)} className={row}>
        {node.label}
      </Link>
    );
  }
  return (
    <Accordion.Item value={node.slug}>
      <Accordion.Header asChild>
        <div>
          <Accordion.Trigger className={`group ${row}`}>
            {node.label}
            <Chevron />
          </Accordion.Trigger>
        </div>
      </Accordion.Header>
      <Accordion.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden motion-reduce:animate-none">
        <div className="border-border ms-3 border-s ps-2">
          <Link href={categoryPath(here)} className={`${row} text-link hover:text-link-hover`}>
            {t("shopAll", { name: node.label })}
          </Link>
          {node.children.map((child) =>
            child.children ? (
              <Accordion.Root key={child.slug} type="single" collapsible>
                <Branch node={child} trail={here} />
              </Accordion.Root>
            ) : (
              <Link
                key={child.slug}
                href={categoryPath([...here, child.slug])}
                className={leafLink}
              >
                {child.label}
              </Link>
            ),
          )}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

/**
 * Mobile and tablet navigation drawer. Radix Dialog provides the focus trap, scroll lock, Escape and aria-modal;
 * it slides in from the inline start (right in Arabic). `footer` carries the language and theme controls.
 */
export function MobileNav({ categories, footer }: { categories: MenuNode[]; footer: ReactNode }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer after navigating. Adjusting state during render (not in an effect) avoids a cascading render.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={t("menu")}
        className="rounded-control hover:bg-accent hover:text-accent-foreground inline-flex size-11 items-center justify-center lg:hidden"
      >
        <Menu aria-hidden="true" className="size-6" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="bg-background text-foreground data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in fixed inset-y-0 start-0 z-50 flex w-[min(24rem,90vw)] flex-col shadow-xl focus:outline-none">
          <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-2">
            <Dialog.Title className="text-heading font-semibold">{t("mobileTitle")}</Dialog.Title>
            <Dialog.Close
              aria-label={t("closeMenu")}
              className="rounded-control hover:bg-accent hover:text-accent-foreground inline-flex size-11 items-center justify-center"
            >
              <X aria-hidden="true" className="size-6" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t("mobileDescription")}</Dialog.Description>

          <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-3">
            <nav aria-label={t("categories")}>
              <Accordion.Root type="single" collapsible>
                {categories.map((cat) => (
                  <Branch key={cat.slug} node={cat} trail={[]} />
                ))}
              </Accordion.Root>
              <Link
                href={routes.deals}
                className={`${row} text-link hover:text-link-hover font-semibold`}
              >
                {t("deals")}
              </Link>
            </nav>
            <nav aria-label={t("utility")} className="border-border mt-4 border-t pt-3">
              <Link href={routes.wishlist} className={row}>
                {t("wishlist")}
              </Link>
              <Link href={routes.account} className={row}>
                {t("account")}
              </Link>
              <Link href={routes.contact} className={row}>
                {t("support")}
              </Link>
            </nav>
          </div>

          <div className="border-border flex flex-col gap-3 border-t px-4 py-3">
            <p className="text-small text-muted-foreground font-medium">{t("preferences")}</p>
            <div className="flex flex-wrap items-center gap-3">{footer}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
