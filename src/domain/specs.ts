import { z } from "zod";

/**
 * Category-specific specs (ADR 0009): values live in Product.specs (JSONB); the SpecDefinition rows of the product's
 * category describe which keys exist, their type and whether they are required or filterable. This module turns
 * definitions into a strict Zod schema, so unknown keys and wrong types are rejected on write.
 */
export const SPEC_TYPES = ["STRING", "NUMBER", "BOOLEAN", "ENUM", "STRING_LIST"] as const;
export type SpecType = (typeof SPEC_TYPES)[number];
export const SPEC_FACETS = ["NONE", "CHECKBOX", "RANGE", "TOGGLE"] as const;
export type SpecFacet = (typeof SPEC_FACETS)[number];

export const SPEC_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export type SpecOption = { value: string; labelEn: string; labelAr: string };

export type SpecDef = {
  key: string;
  type: SpecType;
  unit?: string | null;
  labelEn: string;
  labelAr: string;
  required: boolean;
  filterable: boolean;
  facet: SpecFacet;
  options?: readonly SpecOption[] | null;
  minValue?: number | null;
  maxValue?: number | null;
};

const text = z.string().trim().min(1).max(200);

function schemaFor(def: SpecDef): z.ZodType {
  switch (def.type) {
    case "STRING":
      return text;
    case "BOOLEAN":
      return z.boolean();
    case "NUMBER": {
      let n = z.number().finite();
      if (def.minValue != null) n = n.min(def.minValue);
      if (def.maxValue != null) n = n.max(def.maxValue);
      return n;
    }
    case "ENUM": {
      const values = (def.options ?? []).map((o) => o.value);
      if (values.length === 0) throw new Error(`spec "${def.key}" is an ENUM without options`);
      return z.enum(values as [string, ...string[]]);
    }
    case "STRING_LIST":
      return z.array(text).min(1).max(20);
  }
}

/** Strict schema for the specs of one category. Unknown keys fail; optional specs may be omitted. */
export function buildSpecSchema(defs: readonly SpecDef[]) {
  const keys = new Set<string>();
  const shape: Record<string, z.ZodType> = {};
  for (const def of defs) {
    if (!SPEC_KEY_PATTERN.test(def.key)) throw new Error(`invalid spec key "${def.key}"`);
    if (keys.has(def.key)) throw new Error(`duplicate spec key "${def.key}"`);
    keys.add(def.key);
    const schema = schemaFor(def);
    shape[def.key] = def.required ? schema : schema.optional();
  }
  return z.object(shape).strict();
}

export type SpecIssue = { key: string; message: string };
export type SpecParseResult =
  { success: true; data: Record<string, unknown> } | { success: false; issues: SpecIssue[] };

export function parseSpecs(defs: readonly SpecDef[], raw: unknown): SpecParseResult {
  const result = buildSpecSchema(defs).safeParse(raw);
  if (result.success) return { success: true, data: result.data as Record<string, unknown> };
  return {
    success: false,
    issues: result.error.issues.map((i) => ({
      key: i.path.join(".") || "(root)",
      message: i.message,
    })),
  };
}

/** Definitions that become filters on the listing page, in display order. */
export const filterableSpecs = (defs: readonly SpecDef[]): SpecDef[] =>
  defs.filter((d) => d.filterable && d.facet !== "NONE");

/**
 * Definitions are attached to the category that owns a product family (for example `components/cpus`); products live in
 * its sub-categories (`components/cpus/amd-ryzen`) and use the NEAREST ancestor that has definitions. A sub-category
 * with its own definitions (case fans under cooling) overrides the family's. Returns [] when no ancestor has any.
 */
export function resolveSpecDefinitions<T>(
  categoryPath: string,
  definitionsByPath: ReadonlyMap<string, readonly T[]> | Readonly<Record<string, readonly T[]>>,
): readonly T[] {
  const get = (p: string): readonly T[] | undefined =>
    definitionsByPath instanceof Map
      ? definitionsByPath.get(p)
      : (definitionsByPath as Record<string, readonly T[]>)[p];
  const parts = categoryPath.split("/");
  for (let n = parts.length; n >= 1; n--) {
    const defs = get(parts.slice(0, n).join("/"));
    if (defs && defs.length > 0) return defs;
  }
  return [];
}

/**
 * The category that OWNS the spec definitions a category uses: the nearest ancestor (or itself) that has definitions,
 * the same rule as resolveSpecDefinitions. Products that share an owner share a spec table, so they can be compared
 * (an NVIDIA and an AMD graphics card both belong to `components/graphics-cards`). With no definitions anywhere on
 * the path the category stands alone.
 */
export function specOwnerPath(categoryPath: string, ownerPaths: ReadonlySet<string>): string {
  const parts = categoryPath.split("/");
  for (let n = parts.length; n >= 1; n--) {
    const candidate = parts.slice(0, n).join("/");
    if (ownerPaths.has(candidate)) return candidate;
  }
  return categoryPath;
}
