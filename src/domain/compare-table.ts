import { analyzeBuild, PART_ROLES, roleOfCategoryPath, type BuildPart } from "./compatibility";
import {
  hasAnyValue,
  makeRow,
  type CompareCell,
  type CompareRow,
  type CompareSection,
} from "./compare";
import { buildSpecRows, summarizeBuild, type Bilingual } from "./product-page";
import type { SpecDef } from "./specs";

/** What the table builder needs about one product. Plain data: the service maps database rows into it. */
export type CompareInput = {
  type: "PHYSICAL" | "BUNDLE";
  price: number;
  /** Money saved against the compare-at price (parts) or the parts total (bundles); null when nothing is saved. */
  savingsAmount: number | null;
  available: number | null;
  lowStockThreshold: number;
  brand: Bilingual | null;
  modelName: string | null;
  condition: "NEW" | "REFURBISHED";
  warrantyMonths: number;
  specs: Readonly<Record<string, unknown>>;
  /** Bundles: the components, with their category. */
  parts: readonly {
    categoryPath: string;
    title: Bilingual;
    quantity: number;
    specs: Readonly<Record<string, unknown>>;
  }[];
};

const none: CompareCell = { kind: "none" };

const ROLE_ORDER = new Map<string, number>(PART_ROLES.map((r, i) => [r, i]));

/** Components in a stable, build-like order (cpu, board, ram, gpu...); non-build parts come last. */
const pathOrder = (path: string): number => {
  const role = roleOfCategoryPath(path);
  return role ? (ROLE_ORDER.get(role) ?? 99) : 99;
};

/**
 * The comparison table: overview rows for everyone; spec rows (one per category spec definition) for parts; for
 * bundles, one row per kind of component plus a summary. Rows nobody has a value for are left out. Pure.
 *
 * `categoryNames` maps a component category path to its name (the row label of a parts row).
 */
export function buildComparison(
  items: readonly CompareInput[],
  specDefs: readonly SpecDef[],
  categoryNames: Readonly<Record<string, Bilingual>>,
): CompareSection[] {
  if (items.length === 0) return [];
  const sections: CompareSection[] = [];
  const bundles = items.every((i) => i.type === "BUNDLE");

  const overview: CompareRow[] = [
    makeRow(
      "price",
      null,
      items.map((i): CompareCell => ({ kind: "money", amount: i.price })),
    ),
    makeRow(
      "savings",
      null,
      items.map((i): CompareCell =>
        i.savingsAmount !== null ? { kind: "money", amount: i.savingsAmount } : none,
      ),
    ),
    makeRow(
      "availability",
      null,
      items.map((i): CompareCell => ({
        kind: "stock",
        available: i.available,
        lowStockThreshold: i.lowStockThreshold,
      })),
    ),
    makeRow(
      "brand",
      null,
      items.map((i): CompareCell => (i.brand ? { kind: "text", text: i.brand } : none)),
    ),
    makeRow(
      "model",
      null,
      items.map((i): CompareCell =>
        i.modelName ? { kind: "text", text: { en: i.modelName, ar: i.modelName } } : none,
      ),
    ),
    makeRow(
      "condition",
      null,
      items.map((i): CompareCell => ({ kind: "condition", value: i.condition })),
    ),
    // A bundle's warranty is per component (HANDOFF issue 44): no single number for a bundle.
    makeRow(
      "warranty",
      null,
      items.map((i): CompareCell =>
        i.type === "PHYSICAL" && i.warrantyMonths > 0
          ? { kind: "number", value: i.warrantyMonths, unit: "months" }
          : none,
      ),
    ),
  ].filter((r) => hasAnyValue(r.cells));
  sections.push({ id: "overview", rows: overview });

  if (!bundles) {
    const perItem = items.map(
      (i) => new Map(buildSpecRows(specDefs, i.specs).map((r) => [r.key, r])),
    );
    const rows = specDefs.flatMap((def) => {
      const cells = perItem.map((m): CompareCell => {
        const row = m.get(def.key);
        return row ? { kind: "spec", display: row.display } : none;
      });
      return hasAnyValue(cells)
        ? [makeRow(def.key, { en: def.labelEn, ar: def.labelAr }, cells)]
        : [];
    });
    if (rows.length > 0) sections.push({ id: "specs", rows });
    return sections;
  }

  // Bundles: one row per kind of component.
  const paths = [...new Set(items.flatMap((i) => i.parts.map((p) => p.categoryPath)))].sort(
    (a, b) => pathOrder(a) - pathOrder(b) || a.localeCompare(b),
  );
  const partRows = paths.map((path) =>
    makeRow(
      `parts:${path}`,
      categoryNames[path] ?? { en: path, ar: path },
      items.map((i): CompareCell => {
        const mine = i.parts.filter((p) => p.categoryPath === path);
        if (mine.length === 0) return none;
        return {
          kind: "list",
          items: mine.map((p) =>
            p.quantity > 1
              ? { en: `${p.title.en} × ${p.quantity}`, ar: `${p.title.ar} × ${p.quantity}` }
              : p.title,
          ),
        };
      }),
    ),
  );
  if (partRows.length > 0) sections.push({ id: "parts", rows: partRows });

  const builds = items.map((i): BuildPart[] =>
    i.parts.flatMap((p) => {
      const role = roleOfCategoryPath(p.categoryPath);
      return role ? [{ role, quantity: p.quantity, specs: p.specs }] : [];
    }),
  );
  const summaries = builds.map((b) => summarizeBuild(b));
  const summaryRows = [
    makeRow(
      "memory",
      null,
      summaries.map((s): CompareCell =>
        s.memoryGb !== null ? { kind: "number", value: s.memoryGb, unit: "gb" } : none,
      ),
    ),
    makeRow(
      "storage",
      null,
      summaries.map((s): CompareCell =>
        s.storageGb !== null ? { kind: "number", value: s.storageGb, unit: "gb" } : none,
      ),
    ),
    makeRow(
      "psu",
      null,
      summaries.map((s): CompareCell =>
        s.psuWatts !== null ? { kind: "number", value: s.psuWatts, unit: "w" } : none,
      ),
    ),
    makeRow(
      "compat",
      null,
      builds.map((b): CompareCell => {
        if (b.length === 0) return none;
        const r = analyzeBuild(b);
        return {
          kind: "compat",
          status: !r.compatible ? "problem" : r.issues.length > 0 ? "notes" : "ok",
        };
      }),
    ),
  ].filter((r) => hasAnyValue(r.cells));
  if (summaryRows.length > 0) sections.push({ id: "summary", rows: summaryRows });
  return sections;
}
