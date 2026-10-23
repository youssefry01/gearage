import type { Locale } from "@/i18n/locales";

/** One category as stored (flat). `productCount` = visible products in it AND everything below it. */
export type CategoryRow = {
  id: string;
  parentId: string | null;
  slug: string;
  path: string;
  depth: number;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  seoTitleEn: string | null;
  seoTitleAr: string | null;
  seoDescriptionEn: string | null;
  seoDescriptionAr: string | null;
  imageKey: string | null;
  sortOrder: number;
  productCount: number;
};

export type CategoryNode = {
  id: string;
  slug: string;
  path: string;
  depth: number;
  name: { en: string; ar: string };
  description: { en: string | null; ar: string | null };
  seoTitle: { en: string | null; ar: string | null };
  seoDescription: { en: string | null; ar: string | null };
  imageKey: string | null;
  productCount: number;
  children: CategoryNode[];
};

const byOrder = (a: CategoryRow, b: CategoryRow): number =>
  a.sortOrder - b.sortOrder || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

/**
 * Builds the storefront tree from flat rows. Rows must already be limited to ACTIVE categories (the repository does
 * that). Two rules live here so they are tested without a database:
 *  - a category whose parent is missing (inactive or deleted) is dropped with its whole subtree;
 *  - a category with no visible products anywhere below it is hidden (an empty shelf is not a menu item).
 */
export function buildCategoryTree(rows: readonly CategoryRow[]): CategoryNode[] {
  const children = new Map<string | null, CategoryRow[]>();
  const ids = new Set(rows.map((r) => r.id));
  for (const row of rows) {
    // Orphans (parent inactive or missing) are not attached anywhere: they disappear with their subtree.
    if (row.parentId !== null && !ids.has(row.parentId)) continue;
    const list = children.get(row.parentId) ?? [];
    list.push(row);
    children.set(row.parentId, list);
  }
  const make = (row: CategoryRow): CategoryNode => ({
    id: row.id,
    slug: row.slug,
    path: row.path,
    depth: row.depth,
    name: { en: row.nameEn, ar: row.nameAr },
    description: { en: row.descriptionEn, ar: row.descriptionAr },
    seoTitle: { en: row.seoTitleEn, ar: row.seoTitleAr },
    seoDescription: { en: row.seoDescriptionEn, ar: row.seoDescriptionAr },
    imageKey: row.imageKey,
    productCount: row.productCount,
    children: (children.get(row.id) ?? [])
      .filter((c) => c.productCount > 0)
      .sort(byOrder)
      .map(make),
  });
  // Roots are rows with no parent. Rows whose parent id is not in the set never get attached (dropped).
  return (children.get(null) ?? [])
    .filter((r) => r.productCount > 0)
    .sort(byOrder)
    .map(make);
}

export const categoryName = (c: Pick<CategoryNode, "name">, locale: Locale): string =>
  c.name[locale] ?? c.name.en;

/** Locale-less URL path of a category: "components/cpus" -> "/c/components/cpus". */
export const categoryHref = (path: string): string => `/c/${path}`;

/** Resolves a slug trail to its node and the nodes on the way (for breadcrumbs). Undefined when not found. */
export function findCategory(
  tree: readonly CategoryNode[],
  trail: readonly string[],
): { node: CategoryNode; chain: CategoryNode[] } | undefined {
  const chain: CategoryNode[] = [];
  let level: readonly CategoryNode[] = tree;
  for (const slug of trail) {
    const next: CategoryNode | undefined = level.find((c) => c.slug === slug);
    if (!next) return undefined;
    chain.push(next);
    level = next.children;
  }
  const node = chain.at(-1);
  return node ? { node, chain } : undefined;
}

/** Every category path, depth-first (sitemap, static params, tests). */
export function allCategoryPaths(tree: readonly CategoryNode[]): string[] {
  return tree.flatMap((c) => [c.path, ...allCategoryPaths(c.children)]);
}
