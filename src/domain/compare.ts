import { isValidSlug } from "./catalog";
import type { Bilingual, SpecDisplay } from "./product-page";

/**
 * Product comparison rules (M4b). Pure: no I/O, no React.
 *
 * Decision (HANDOFF section 16): at most four products; only products of the SAME GROUP are compared, because specs
 * are defined per category family and a table of a GPU next to a case would be mostly blank. A group is the family
 * that owns the spec definitions (all graphics cards, whatever the brand sub-category) or "bundle" (bundles compare
 * with bundles only, ADR 0010 open decision).
 */
export const COMPARE_MAX = 4;

export const BUNDLE_GROUP = "bundle";

/** Types that can be compared. Gift cards and digital products have no specs worth comparing. */
export const isComparableType = (type: string): boolean => type === "PHYSICAL" || type === "BUNDLE";

/**
 * The comparison group of a product: "bundle", or "cat:<spec owner path>" (the category whose spec definitions the
 * product uses, see specOwnerPath), or null when the product cannot be compared.
 */
export const compareGroup = (type: string, specOwner: string): string | null =>
  type === "BUNDLE" ? BUNDLE_GROUP : type === "PHYSICAL" ? `cat:${specOwner}` : null;

export type CompareCandidate = { slug: string; group: string };

export type AddVerdict = "ok" | "duplicate" | "full" | "mismatch";

/** May `candidate` join the list? Duplicates are reported (the UI turns an add of a duplicate into a removal). */
export function canAddToCompare(
  current: readonly CompareCandidate[],
  candidate: CompareCandidate,
): AddVerdict {
  if (current.some((c) => c.slug === candidate.slug)) return "duplicate";
  if (current.length >= COMPARE_MAX) return "full";
  const first = current[0];
  if (first && first.group !== candidate.group) return "mismatch";
  return "ok";
}

/** `?p=a,b,c` to a clean slug list: valid slugs only, no duplicates, in order, at most COMPARE_MAX. */
export function parseCompareParam(raw: string | string[] | undefined): {
  slugs: string[];
  truncated: boolean;
} {
  const text = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const seen = new Set<string>();
  for (const part of text.split(",")) {
    const slug = part.trim();
    if (slug && isValidSlug(slug) && slug.length <= 80) seen.add(slug);
  }
  const all = [...seen];
  return { slugs: all.slice(0, COMPARE_MAX), truncated: all.length > COMPARE_MAX };
}

/** The `p` value for a list of slugs (the inverse of parseCompareParam). */
export const compareParam = (slugs: readonly string[]): string => slugs.join(",");

/**
 * Keep only the products that share the first product's group (URL order). The rest are returned as `dropped` so the
 * page can say so instead of silently hiding them.
 */
export function selectComparable<T extends { slug: string; group: string }>(
  ordered: readonly T[],
): { kept: T[]; dropped: T[] } {
  const first = ordered[0];
  if (!first) return { kept: [], dropped: [] };
  const kept = ordered.filter((p) => p.group === first.group);
  return { kept, dropped: ordered.filter((p) => p.group !== first.group) };
}

// ---------------------------------------------------------------------------------------------------------------
// The comparison table
// ---------------------------------------------------------------------------------------------------------------

/** One cell. `null` = this product has no value for the row ("not listed"). */
export type CompareCell =
  | { kind: "spec"; display: SpecDisplay }
  | { kind: "text"; text: Bilingual }
  | { kind: "number"; value: number; unit: "months" | "gb" | "w" | "parts" }
  | { kind: "money"; amount: number }
  | { kind: "list"; items: Bilingual[] }
  | { kind: "stock"; available: number | null; lowStockThreshold: number }
  | { kind: "condition"; value: "NEW" | "REFURBISHED" }
  | { kind: "compat"; status: "ok" | "notes" | "problem" }
  | { kind: "none" };

export type CompareRow = {
  /** Stable id (a spec key, or an overview key). */
  id: string;
  /** null = a built-in row (price, stock...): the UI translates it by `id`. Spec and parts rows carry both languages. */
  label: Bilingual | null;
  cells: CompareCell[];
  /** True when the values are not all the same (a cell without a value counts as different from one with a value). */
  differs: boolean;
};

export type CompareSection = { id: "overview" | "specs" | "parts" | "summary"; rows: CompareRow[] };

/**
 * A comparable fingerprint of a cell: equal fingerprints mean "the same value". Stock is deliberately NOT compared
 * by quantity (two products with different stock levels are not a difference worth highlighting): only whether
 * they can be bought. Prices are compared exactly.
 */
export function cellKey(cell: CompareCell): string {
  switch (cell.kind) {
    case "none":
      return "none";
    case "spec": {
      const d = cell.display;
      switch (d.kind) {
        case "text":
          return `t:${d.text.en}`;
        case "number":
          return `n:${d.value}:${d.unit ?? ""}`;
        case "boolean":
          return `b:${d.value}`;
        case "list":
          return `l:${[...d.items].sort().join("|")}`;
      }
      break;
    }
    case "text":
      return `t:${cell.text.en}`;
    case "number":
      return `n:${cell.value}:${cell.unit}`;
    case "money":
      return `m:${cell.amount}`;
    case "list":
      return `l:${cell.items
        .map((i) => i.en)
        .sort()
        .join("|")}`;
    case "stock":
      return `s:${cell.available === null || cell.available > 0 ? "in" : "out"}`;
    case "condition":
      return `c:${cell.value}`;
    case "compat":
      return `k:${cell.status}`;
  }
  return "none";
}

/** A row with `differs` computed. A single product has nothing to differ from, so never differs. */
export function makeRow(id: string, label: Bilingual | null, cells: CompareCell[]): CompareRow {
  const keys = new Set(cells.map(cellKey));
  return { id, label, cells, differs: cells.length > 1 && keys.size > 1 };
}

/** A row is worth showing when at least one product has a value. */
export const hasAnyValue = (cells: readonly CompareCell[]): boolean =>
  cells.some((c) => c.kind !== "none");

/** "Differences only" view: sections keep only differing rows; empty sections disappear. */
export function onlyDifferences(sections: readonly CompareSection[]): CompareSection[] {
  return sections
    .map((s) => ({ ...s, rows: s.rows.filter((r) => r.differs) }))
    .filter((s) => s.rows.length > 0);
}
