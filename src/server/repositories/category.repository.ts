import type { CategoryRow } from "@/domain/category-tree";
import type { SpecDef, SpecOption } from "@/domain/specs";
import { getDb } from "@/server/db";

/**
 * All ACTIVE categories with the number of visible (ACTIVE, not deleted) products in each one and below it, in ONE
 * statement. Paths contain only [a-z0-9-/], so the LIKE prefix needs no escaping.
 */
export async function fetchActiveCategories(): Promise<CategoryRow[]> {
  return getDb().$queryRaw<CategoryRow[]>`
    SELECT c."id", c."parentId", c."slug", c."path", c."depth",
           c."nameEn", c."nameAr", c."descriptionEn", c."descriptionAr",
           c."seoTitleEn", c."seoTitleAr", c."seoDescriptionEn", c."seoDescriptionAr",
           c."imageKey", c."sortOrder",
           (SELECT COUNT(*)::int
              FROM "product" p
              JOIN "category" pc ON pc."id" = p."categoryId"
             WHERE p."status" = 'ACTIVE' AND p."deletedAt" IS NULL
               AND (pc."path" = c."path" OR pc."path" LIKE c."path" || '/%')) AS "productCount"
    FROM "category" c
    WHERE c."isActive"
    ORDER BY c."depth", c."sortOrder", c."slug"`;
}

type SpecRow = {
  categoryPath: string;
  key: string;
  type: SpecDef["type"];
  unit: string | null;
  labelEn: string;
  labelAr: string;
  filterable: boolean;
  facet: SpecDef["facet"];
  required: boolean;
  options: SpecOption[] | null;
  minValue: number | null;
  maxValue: number | null;
};

/** Spec definitions of every category, grouped by the path of the category that owns them, in display order. */
export async function fetchSpecDefinitionsByPath(): Promise<Map<string, SpecDef[]>> {
  const rows = await getDb().$queryRaw<SpecRow[]>`
    SELECT c."path" AS "categoryPath", d."key", d."type", d."unit", d."labelEn", d."labelAr",
           d."filterable", d."facet", d."required", d."options", d."minValue", d."maxValue"
    FROM "spec_definition" d
    JOIN "category" c ON c."id" = d."categoryId"
    ORDER BY c."path", d."sortOrder", d."key"`;
  const map = new Map<string, SpecDef[]>();
  for (const r of rows) {
    const list = map.get(r.categoryPath) ?? [];
    list.push({
      key: r.key,
      type: r.type,
      unit: r.unit,
      labelEn: r.labelEn,
      labelAr: r.labelAr,
      required: r.required,
      filterable: r.filterable,
      facet: r.facet,
      options: r.options,
      minValue: r.minValue,
      maxValue: r.maxValue,
    });
    map.set(r.categoryPath, list);
  }
  return map;
}
