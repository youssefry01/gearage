"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { routes } from "@/config/routes";
import { categoryPath } from "@/features/navigation/categories";
import { Link, usePathname } from "@/i18n/navigation";
import type { MenuNode } from "./menu-tree";

const triggerClass =
  "group inline-flex min-h-11 items-center gap-1 rounded-control px-3 text-small font-medium text-foreground transition-colors duration-fast ease-standard hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground";

const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 220;

/**
 * Category row with full-width mega panels (desktop). Implements the WAI-ARIA "disclosure navigation" pattern, which
 * is the recommended one for site navigation: each category is a <button aria-expanded> that reveals a panel of
 * ordinary links (no menu roles, no focus proxies). Hover (mouse only, with intent delay) and click/Enter/Space open
 * it; Escape closes it and returns focus to the trigger; focus leaving the nav or a click outside closes it. Tab moves
 * naturally from a trigger into its panel because the panel is the next element in the DOM. The panel is positioned
 * against the sticky header, so it spans the full width. The category's own page is the first link in its panel.
 */
export function MegaMenu({ categories }: { categories: MenuNode[] }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const baseId = useId();
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Close after navigating (adjust state during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpenSlug(null);
  }

  const later = (slug: string | null, delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpenSlug(slug), delay);
  };

  // Click or tap outside the nav closes it.
  useEffect(() => {
    if (!openSlug) return;
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenSlug(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [openSlug]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && openSlug) {
      e.stopPropagation();
      const slug = openSlug;
      setOpenSlug(null);
      triggers.current.get(slug)?.focus();
    }
  };

  return (
    <nav
      ref={navRef}
      aria-label={t("categories")}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpenSlug(null);
      }}
    >
      <ul className="flex items-center gap-1">
        {categories.map((cat) => {
          const open = openSlug === cat.slug;
          const panelId = `${baseId}-${cat.slug}`;
          return (
            <li
              key={cat.slug}
              onPointerEnter={(e) => e.pointerType === "mouse" && later(cat.slug, OPEN_DELAY_MS)}
              onPointerLeave={(e) => e.pointerType === "mouse" && later(null, CLOSE_DELAY_MS)}
            >
              <button
                type="button"
                ref={(el) => {
                  if (el) triggers.current.set(cat.slug, el);
                  else triggers.current.delete(cat.slug);
                }}
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => {
                  clearTimeout(timer.current);
                  setOpenSlug(open ? null : cat.slug);
                }}
                className={triggerClass}
              >
                {cat.label}
                <ChevronDown
                  aria-hidden="true"
                  className="duration-fast size-4 transition-transform group-aria-expanded:rotate-180 motion-reduce:transition-none"
                />
              </button>
              {open ? (
                <div
                  id={panelId}
                  className="border-border bg-popover text-popover-foreground motion-safe:animate-mega-in absolute inset-x-0 top-full z-30 border-b shadow-lg"
                >
                  <div className="max-w-page px-gutter mx-auto max-h-[calc(100dvh-12rem)] overflow-y-auto py-6">
                    <Link
                      href={categoryPath([cat.slug])}
                      className="rounded-control text-heading text-link hover:text-link-hover mb-4 inline-flex min-h-11 items-center gap-2 font-semibold"
                    >
                      {t("shopAll", { name: cat.label })}
                      <ArrowRight aria-hidden="true" className="size-5 rtl:-scale-x-100" />
                    </Link>
                    <ul className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-x-8 gap-y-4">
                      {cat.children?.map((group) => (
                        <li key={group.slug}>
                          <Link
                            href={categoryPath([cat.slug, group.slug])}
                            className="rounded-control hover:text-link-hover inline-flex min-h-11 items-center font-semibold"
                          >
                            {group.label}
                          </Link>
                          {group.children ? (
                            <ul>
                              {group.children.map((leaf) => (
                                <li key={leaf.slug}>
                                  <Link
                                    href={categoryPath([cat.slug, group.slug, leaf.slug])}
                                    className="rounded-control text-small text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center"
                                  >
                                    {leaf.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
        <li>
          <Link
            href={routes.deals}
            className={`${triggerClass} text-link hover:text-link-hover font-semibold`}
          >
            {t("deals")}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
