import { describe, expect, it } from "vitest";
import {
  buildSpecSchema,
  filterableSpecs,
  parseSpecs,
  resolveSpecDefinitions,
  type SpecDef,
} from "./specs";

const def = (over: Partial<SpecDef> & Pick<SpecDef, "key" | "type">): SpecDef => ({
  labelEn: over.key,
  labelAr: over.key,
  required: false,
  filterable: false,
  facet: "NONE",
  ...over,
});

const cpuDefs: SpecDef[] = [
  def({
    key: "socket",
    type: "ENUM",
    required: true,
    filterable: true,
    facet: "CHECKBOX",
    options: [
      { value: "AM5", labelEn: "AM5", labelAr: "AM5" },
      { value: "LGA1700", labelEn: "LGA1700", labelAr: "LGA1700" },
    ],
  }),
  def({
    key: "cores",
    type: "NUMBER",
    required: true,
    filterable: true,
    facet: "RANGE",
    minValue: 1,
    maxValue: 256,
  }),
  def({ key: "tdp_w", type: "NUMBER", unit: "W" }),
  def({ key: "unlocked", type: "BOOLEAN", filterable: true, facet: "TOGGLE" }),
  def({ key: "notes", type: "STRING" }),
  def({ key: "features", type: "STRING_LIST" }),
];

describe("parseSpecs", () => {
  it("accepts valid specs, optional ones may be omitted", () => {
    const r = parseSpecs(cpuDefs, {
      socket: "AM5",
      cores: 6,
      tdp_w: 65,
      unlocked: true,
      features: ["AVX-512"],
    });
    expect(r.success).toBe(true);
    expect(parseSpecs(cpuDefs, { socket: "AM5", cores: 6 }).success).toBe(true);
  });
  it("reports missing required keys", () => {
    const r = parseSpecs(cpuDefs, { cores: 6 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues.map((i) => i.key)).toContain("socket");
  });
  it("rejects unknown keys (typos never reach the database)", () => {
    const r = parseSpecs(cpuDefs, { socket: "AM5", cores: 6, coers: 8 });
    expect(r.success).toBe(false);
  });
  it("rejects wrong types, values outside the allowed range, and unknown enum values", () => {
    expect(parseSpecs(cpuDefs, { socket: "AM5", cores: "6" }).success).toBe(false);
    expect(parseSpecs(cpuDefs, { socket: "AM5", cores: 0 }).success).toBe(false);
    expect(parseSpecs(cpuDefs, { socket: "AM5", cores: 1000 }).success).toBe(false);
    expect(parseSpecs(cpuDefs, { socket: "AM6", cores: 6 }).success).toBe(false);
    expect(parseSpecs(cpuDefs, { socket: "AM5", cores: Number.NaN }).success).toBe(false);
    expect(parseSpecs(cpuDefs, { socket: "AM5", cores: 6, features: [] }).success).toBe(false);
    expect(parseSpecs(cpuDefs, { socket: "AM5", cores: 6, notes: "   " }).success).toBe(false);
  });
  it("rejects non-objects", () => {
    for (const bad of [null, "x", 5, []]) expect(parseSpecs(cpuDefs, bad).success).toBe(false);
  });
});

describe("buildSpecSchema", () => {
  it("rejects malformed definitions up front", () => {
    expect(() => buildSpecSchema([def({ key: "Bad-Key", type: "STRING" })])).toThrow(
      /invalid spec key/,
    );
    expect(() =>
      buildSpecSchema([def({ key: "a", type: "STRING" }), def({ key: "a", type: "NUMBER" })]),
    ).toThrow(/duplicate/);
    expect(() => buildSpecSchema([def({ key: "e", type: "ENUM", options: [] })])).toThrow(
      /without options/,
    );
  });
});

describe("filterableSpecs", () => {
  it("returns only specs that are filters", () => {
    expect(filterableSpecs(cpuDefs).map((d) => d.key)).toEqual(["socket", "cores", "unlocked"]);
  });
});

describe("resolveSpecDefinitions", () => {
  const cooling = [def({ key: "cooler_type", type: "STRING" })];
  const fans = [def({ key: "size_mm", type: "NUMBER" })];
  const byPath = new Map([
    ["components/cooling", cooling],
    ["components/cooling/case-fans", fans],
  ]);
  it("uses the nearest ancestor with definitions", () => {
    expect(resolveSpecDefinitions("components/cooling/air-coolers", byPath)).toBe(cooling);
    expect(resolveSpecDefinitions("components/cooling", byPath)).toBe(cooling);
  });
  it("lets a sub-category override its family", () => {
    expect(resolveSpecDefinitions("components/cooling/case-fans", byPath)).toBe(fans);
  });
  it("returns [] when nothing above has definitions, and does not match by loose prefix", () => {
    expect(resolveSpecDefinitions("monitors/gaming-monitors", byPath)).toEqual([]);
    expect(resolveSpecDefinitions("components/cooling-extra", byPath)).toEqual([]);
  });
  it("also accepts a plain record", () => {
    expect(resolveSpecDefinitions("a/b", { a: cooling })).toBe(cooling);
  });
});
