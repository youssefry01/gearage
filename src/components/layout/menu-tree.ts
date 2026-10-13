import { categoryName, type NavCategory } from "@/features/navigation/categories";
import type { Locale } from "@/i18n/locales";

/** Locale-resolved category tree handed to client components, so they never ship both languages. */
export type MenuNode = { slug: string; label: string; children?: MenuNode[] };

export function toMenuTree(nodes: NavCategory[], locale: Locale): MenuNode[] {
  return nodes.map((n) => ({
    slug: n.slug,
    label: categoryName(n, locale),
    ...(n.children ? { children: toMenuTree(n.children, locale) } : {}),
  }));
}
