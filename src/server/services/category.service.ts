import { type CategoryNode, buildCategoryTree, findCategory } from "@/domain/category-tree";
import type { SpecDef } from "@/domain/specs";
import { resolveSpecDefinitions, specOwnerPath } from "@/domain/specs";
import { ttlCache } from "@/server/cache/ttl";
import {
  fetchActiveCategories,
  fetchSpecDefinitionsByPath,
} from "@/server/repositories/category.repository";

const TTL_MS = 60_000;

const treeCache = ttlCache(async () => buildCategoryTree(await fetchActiveCategories()), TTL_MS);
const specCache = ttlCache(fetchSpecDefinitionsByPath, TTL_MS);

/**
 * The storefront category tree (active categories that contain visible products). With no DATABASE_URL (the CI
 * `verify` build, which has no database) it is empty; with one configured, a database error propagates on purpose:
 * a static page must fail to (re)generate and keep serving its last good version rather than cache an empty menu.
 */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  if (!process.env.DATABASE_URL) return [];
  return treeCache.get();
}

export async function getCategory(trail: readonly string[]) {
  return findCategory(await getCategoryTree(), trail);
}

/** Spec definitions that apply to a category path: its own, else the nearest ancestor's (ADR 0009). */
export async function getSpecDefinitions(categoryPath: string): Promise<readonly SpecDef[]> {
  if (!process.env.DATABASE_URL) return [];
  return resolveSpecDefinitions(categoryPath, await specCache.get());
}

/** Category path to the path that owns its spec definitions (the compare group of a product). Cached like the definitions. */
export type SpecOwnerResolver = (categoryPath: string) => string;

export async function getSpecOwnerResolver(): Promise<SpecOwnerResolver> {
  if (!process.env.DATABASE_URL) return (path) => path;
  const owners = new Set((await specCache.get()).keys());
  return (path) => specOwnerPath(path, owners);
}

/** Test hook. */
export function clearCategoryCaches(): void {
  treeCache.clear();
  specCache.clear();
}
