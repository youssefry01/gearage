import { isValidSlug } from "./catalog";

/** How many products the device remembers, and how many the shelf shows. */
export const RECENT_MAX = 12;
export const RECENT_SHOWN = 8;

/** Put `slug` first; an earlier entry of the same slug moves, it is never duplicated; the list is capped. */
export function pushRecent(list: readonly string[], slug: string, max = RECENT_MAX): string[] {
  if (!isValidSlug(slug)) return [...list];
  return [slug, ...list.filter((s) => s !== slug)].slice(0, max);
}

/**
 * Anything read back from localStorage is untrusted (the shopper, an extension or an old version may have written
 * it): keep only valid, unique slugs, newest first, capped. Never throws.
 */
export function parseStoredRecent(raw: unknown, max = RECENT_MAX): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v === "string" && v.length <= 80 && isValidSlug(v)) seen.add(v);
    if (seen.size >= max) break;
  }
  return [...seen];
}

/** The slugs to show: newest first, without the product being viewed, at most RECENT_SHOWN. */
export const shelfSlugs = (list: readonly string[], except?: string): string[] =>
  list.filter((s) => s !== except).slice(0, RECENT_SHOWN);
