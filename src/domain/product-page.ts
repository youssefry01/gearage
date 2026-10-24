import type { BuildPart } from "./compatibility";
import type { SpecDef } from "./specs";

export type Bilingual = { en: string; ar: string };

/** How one spec value is shown. Numbers stay numbers (the UI formats digits and unit per locale). */
export type SpecDisplay =
  | { kind: "text"; text: Bilingual }
  | { kind: "number"; value: number; unit: string | null }
  | { kind: "boolean"; value: boolean }
  | { kind: "list"; items: string[] };

export type SpecRow = { key: string; label: Bilingual; display: SpecDisplay };

/**
 * The product's specs as table rows, in the category's definition order. Only keys that have a definition and a
 * usable value are shown (an unknown key or a value of the wrong type is skipped, never printed raw).
 * ENUM values resolve to the option's bilingual label.
 */
export function buildSpecRows(
  defs: readonly SpecDef[],
  specs: Readonly<Record<string, unknown>>,
): SpecRow[] {
  const rows: SpecRow[] = [];
  for (const def of defs) {
    const value = specs[def.key];
    if (value === undefined || value === null) continue;
    const label = { en: def.labelEn, ar: def.labelAr };
    switch (def.type) {
      case "NUMBER":
        if (typeof value === "number" && Number.isFinite(value))
          rows.push({
            key: def.key,
            label,
            display: { kind: "number", value, unit: def.unit ?? null },
          });
        break;
      case "BOOLEAN":
        if (typeof value === "boolean")
          rows.push({ key: def.key, label, display: { kind: "boolean", value } });
        break;
      case "ENUM": {
        if (typeof value !== "string") break;
        const option = def.options?.find((o) => o.value === value);
        rows.push({
          key: def.key,
          label,
          display: {
            kind: "text",
            text: option ? { en: option.labelEn, ar: option.labelAr } : { en: value, ar: value },
          },
        });
        break;
      }
      case "STRING":
        if (typeof value === "string" && value.trim() !== "")
          rows.push({
            key: def.key,
            label,
            display: { kind: "text", text: { en: value, ar: value } },
          });
        break;
      case "STRING_LIST": {
        const items = Array.isArray(value)
          ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "")
          : [];
        if (items.length > 0) rows.push({ key: def.key, label, display: { kind: "list", items } });
        break;
      }
    }
  }
  return rows;
}

/** Physical facts shown under "General", only the ones that exist. Dimensions are L x W x H in mm. */
export type PhysicalFacts = {
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
};

export function dimensionsMm(
  f: PhysicalFacts,
): { length: number; width: number; height: number } | null {
  return f.lengthMm && f.widthMm && f.heightMm
    ? { length: f.lengthMm, width: f.widthMm, height: f.heightMm }
    : null;
}

/** A bundle's headline numbers, computed from its components' specs. Anything that cannot be known is null. */
export type BuildSummary = {
  /** Total memory in GB (kit capacity times kits) and its type ("DDR5"). */
  memoryGb: number | null;
  memoryType: string | null;
  /** Total storage in GB across drives. */
  storageGb: number | null;
  psuWatts: number | null;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

export function summarizeBuild(parts: readonly BuildPart[]): BuildSummary {
  const sumOf = (role: BuildPart["role"], key: string): number | null => {
    const rows = parts.filter((p) => p.role === role);
    if (rows.length === 0) return null;
    let total = 0;
    for (const r of rows) {
      const n = num(r.specs[key]);
      if (n === null) return null;
      total += n * (r.quantity ?? 1);
    }
    return total;
  };
  const ram = parts.find((p) => p.role === "ram");
  const psu = parts.find((p) => p.role === "psu");
  return {
    memoryGb: sumOf("ram", "capacity_gb"),
    memoryType: ram ? str(ram.specs["memory_type"]) : null,
    storageGb: sumOf("storage", "capacity_gb"),
    psuWatts: psu ? num(psu.specs["wattage_w"]) : null,
  };
}

/** Can this component of a bundle be supplied right now? "unavailable" = archived or deleted (the bundle is unavailable too). */
export type PartAvailability = "ok" | "short" | "unavailable";

export function partAvailability(part: {
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  deleted: boolean;
  quantity: number;
  available: number;
}): PartAvailability {
  if (part.deleted || part.status !== "ACTIVE") return "unavailable";
  return part.available < part.quantity ? "short" : "ok";
}
