import { isValidSlug } from "./catalog";
import { COMPARE_MAX } from "./compare";

/**
 * What the device remembers about the compare list. A small display snapshot (title, thumbnail) is stored so the
 * tray needs no network request; the comparison page itself always reads fresh data from the server. Everything
 * is validated on the way back in: localStorage is untrusted input.
 */
export type CompareItem = {
  slug: string;
  group: string;
  title: { en: string; ar: string };
  /** A site-relative image path (our own storage) or null. */
  image: string | null;
};

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.length > 0 && v.length <= max ? v : null;

/** Only paths on our own origin: no scheme, no protocol-relative URL, no traversal. */
export const isSafeImagePath = (v: unknown): v is string =>
  typeof v === "string" &&
  v.length <= 300 &&
  v.startsWith("/") &&
  !v.startsWith("//") &&
  !v.includes("\\") &&
  !v.includes("..") &&
  !/[\u0000-\u001f]/.test(v);

export function parseStoredCompare(raw: unknown): CompareItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CompareItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const slug = str(e["slug"], 80);
    const group = str(e["group"], 200);
    const title = e["title"] as Record<string, unknown> | null | undefined;
    const en = str(title?.["en"], 300);
    const ar = str(title?.["ar"], 300);
    if (!slug || !isValidSlug(slug) || !group || !en || !ar) continue;
    if (out.some((o) => o.slug === slug)) continue;
    // One group per list: a tampered or older list with mixed groups keeps the first group.
    if (out[0] && out[0].group !== group) continue;
    out.push({
      slug,
      group,
      title: { en, ar },
      image: isSafeImagePath(e["image"]) ? e["image"] : null,
    });
    if (out.length >= COMPARE_MAX) break;
  }
  return out;
}
