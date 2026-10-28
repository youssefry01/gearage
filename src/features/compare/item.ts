import { isSafeImagePath, type CompareItem } from "@/domain/compare-storage";

type Source = {
  slug: string;
  compareGroup: string | null;
  title: { en: string; ar: string };
  image: { url: string } | null;
};

/** The compare-list entry for a card or product page; null for products that cannot be compared. */
export function toCompareItem(p: Source): CompareItem | null {
  if (!p.compareGroup) return null;
  return {
    slug: p.slug,
    group: p.compareGroup,
    title: { en: p.title.en, ar: p.title.ar },
    image: p.image && isSafeImagePath(p.image.url) ? p.image.url : null,
  };
}
