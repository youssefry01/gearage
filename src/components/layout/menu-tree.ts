import { type CategoryNode, categoryName } from "@/domain/category-tree";
import type { Locale } from "@/i18n/locales";

/** Locale-resolved category tree handed to client components, so they never ship both languages. */
export type MenuNode = { slug: string; label: string; children?: MenuNode[] };

export function toMenuTree(nodes: readonly CategoryNode[], locale: Locale): MenuNode[] {
  return nodes.map((n) => ({
    slug: n.slug,
    label: categoryName(n, locale),
    ...(n.children.length > 0 ? { children: toMenuTree(n.children, locale) } : {}),
  }));
}
