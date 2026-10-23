import { describe, expect, it } from "vitest";
import {
  type CategoryRow,
  allCategoryPaths,
  buildCategoryTree,
  categoryHref,
  categoryName,
  findCategory,
} from "./category-tree";

let n = 0;
const row = (
  over: Partial<CategoryRow> & Pick<CategoryRow, "slug" | "path" | "depth">,
): CategoryRow => ({
  id: over.id ?? `id-${over.path}`,
  parentId: null,
  nameEn: over.slug,
  nameAr: `${over.slug}-ar`,
  descriptionEn: null,
  descriptionAr: null,
  seoTitleEn: null,
  seoTitleAr: null,
  seoDescriptionEn: null,
  seoDescriptionAr: null,
  imageKey: null,
  sortOrder: n++,
  productCount: 1,
  ...over,
});

const rows: CategoryRow[] = [
  row({ slug: "components", path: "components", depth: 1, sortOrder: 2 }),
  row({ slug: "cpus", path: "components/cpus", depth: 2, parentId: "id-components", sortOrder: 2 }),
  row({ slug: "gpus", path: "components/gpus", depth: 2, parentId: "id-components", sortOrder: 1 }),
  row({
    slug: "empty",
    path: "components/empty",
    depth: 2,
    parentId: "id-components",
    productCount: 0,
  }),
  row({ slug: "monitors", path: "monitors", depth: 1, sortOrder: 1 }),
  row({ slug: "orphan", path: "ghost/orphan", depth: 2, parentId: "id-ghost" }),
  row({ slug: "empty-top", path: "empty-top", depth: 1, productCount: 0 }),
];

describe("buildCategoryTree", () => {
  const tree = buildCategoryTree(rows);

  it("orders siblings by sortOrder and nests children", () => {
    expect(tree.map((c) => c.slug)).toEqual(["monitors", "components"]);
    expect(tree[1]?.children.map((c) => c.slug)).toEqual(["gpus", "cpus"]);
  });
  it("hides categories without visible products", () => {
    expect(allCategoryPaths(tree)).not.toContain("components/empty");
    expect(allCategoryPaths(tree)).not.toContain("empty-top");
  });
  it("drops a category whose parent is missing (inactive) with its subtree", () => {
    expect(allCategoryPaths(tree)).not.toContain("ghost/orphan");
  });
  it("resolves slug trails, with the chain for breadcrumbs", () => {
    expect(findCategory(tree, ["components", "cpus"])?.chain.map((c) => c.slug)).toEqual([
      "components",
      "cpus",
    ]);
    expect(findCategory(tree, ["components", "empty"])).toBeUndefined();
    expect(findCategory(tree, [])).toBeUndefined();
    expect(findCategory(tree, ["nope"])).toBeUndefined();
  });
  it("lists every path depth-first and builds hrefs", () => {
    expect(allCategoryPaths(tree)).toEqual([
      "monitors",
      "components",
      "components/gpus",
      "components/cpus",
    ]);
    expect(categoryHref("components/cpus")).toBe("/c/components/cpus");
  });
  it("picks the locale's name", () => {
    const node = findCategory(tree, ["monitors"])?.node;
    expect(node && categoryName(node, "ar")).toBe("monitors-ar");
    expect(node && categoryName(node, "en")).toBe("monitors");
  });
});
