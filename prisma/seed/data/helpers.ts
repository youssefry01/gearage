import type { SpecDef, SpecFacet, SpecOption } from "@/domain/specs";
import type { Localized } from "../types";

export const t = (en: string, ar: string): Localized => ({ en, ar });

/** Technical tokens (DDR5, AM5, NVMe) read the same in both languages. */
export const tokens = (values: readonly string[]): SpecOption[] =>
  values.map((v) => ({ value: v, labelEn: v, labelAr: v }));

export const option = (value: string, labelEn: string, labelAr: string): SpecOption => ({
  value,
  labelEn,
  labelAr,
});

type Common = { required?: boolean; facet?: SpecFacet; unit?: string };

const base = (key: string, labelEn: string, labelAr: string, c: Common) => ({
  key,
  labelEn,
  labelAr,
  unit: c.unit ?? null,
  required: c.required ?? false,
  facet: c.facet ?? "NONE",
  filterable: (c.facet ?? "NONE") !== "NONE",
});

/** Facet convention: CHECKBOX for discrete values, RANGE for continuous numbers, TOGGLE for booleans. */
export const numberSpec = (
  key: string,
  labelEn: string,
  labelAr: string,
  c: Common & { min?: number; max?: number } = {},
): SpecDef => ({
  ...base(key, labelEn, labelAr, c),
  type: "NUMBER",
  minValue: c.min ?? 0,
  maxValue: c.max ?? null,
});

export const textSpec = (
  key: string,
  labelEn: string,
  labelAr: string,
  c: Common = {},
): SpecDef => ({ ...base(key, labelEn, labelAr, c), type: "STRING" });

export const boolSpec = (
  key: string,
  labelEn: string,
  labelAr: string,
  c: Omit<Common, "facet"> & { filter?: boolean } = {},
): SpecDef => ({
  ...base(key, labelEn, labelAr, { ...c, facet: c.filter ? "TOGGLE" : "NONE" }),
  type: "BOOLEAN",
});

export const enumSpec = (
  key: string,
  labelEn: string,
  labelAr: string,
  options: readonly SpecOption[],
  c: Common = {},
): SpecDef => ({ ...base(key, labelEn, labelAr, c), type: "ENUM", options });

export const listSpec = (
  key: string,
  labelEn: string,
  labelAr: string,
  c: Common = {},
): SpecDef => ({ ...base(key, labelEn, labelAr, c), type: "STRING_LIST" });

/** Illustrative whole-EGP price helper kept next to the data for readability. */
export const DEFAULT_COST_RATIO = 0.88;
