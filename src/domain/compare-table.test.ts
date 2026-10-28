import { describe, expect, it } from "vitest";
import { buildComparison, type CompareInput } from "./compare-table";
import type { SpecDef } from "./specs";

const base = (over: Partial<CompareInput>): CompareInput => ({
  type: "PHYSICAL",
  price: 100_00,
  savingsAmount: null,
  available: 5,
  lowStockThreshold: 3,
  brand: { en: "Acme", ar: "أكمي" },
  modelName: null,
  condition: "NEW",
  warrantyMonths: 36,
  specs: {},
  parts: [],
  ...over,
});

const defs: SpecDef[] = [
  {
    key: "vram_gb",
    type: "NUMBER",
    unit: "GB",
    labelEn: "VRAM",
    labelAr: "VRAM",
    required: true,
    filterable: true,
    facet: "RANGE",
  },
  {
    key: "ray",
    type: "BOOLEAN",
    labelEn: "Ray tracing",
    labelAr: "RT",
    required: false,
    filterable: false,
    facet: "NONE",
  },
  {
    key: "unused",
    type: "STRING",
    labelEn: "Unused",
    labelAr: "x",
    required: false,
    filterable: false,
    facet: "NONE",
  },
];

const row = (sections: ReturnType<typeof buildComparison>, id: string) =>
  sections.flatMap((s) => s.rows).find((r) => r.id === id);

describe("buildComparison: parts", () => {
  const a = base({ price: 100_00, specs: { vram_gb: 8, ray: true } });
  const b = base({ price: 120_00, specs: { vram_gb: 8, ray: false }, warrantyMonths: 36 });
  const sections = buildComparison([a, b], defs, {});

  it("has overview and specs sections, specs in definition order", () => {
    expect(sections.map((s) => s.id)).toEqual(["overview", "specs"]);
    expect(sections[1]?.rows.map((r) => r.id)).toEqual(["vram_gb", "ray"]);
  });
  it("leaves out a spec nobody has and rows nobody has a value for", () => {
    expect(row(sections, "unused")).toBeUndefined();
    expect(row(sections, "savings")).toBeUndefined();
    expect(row(sections, "model")).toBeUndefined();
  });
  it("marks only rows with different values", () => {
    expect(row(sections, "price")?.differs).toBe(true);
    expect(row(sections, "vram_gb")?.differs).toBe(false);
    expect(row(sections, "ray")?.differs).toBe(true);
    expect(row(sections, "warranty")?.differs).toBe(false);
  });
  it("shows a missing spec as no value and counts it as a difference", () => {
    const s = buildComparison([a, base({ specs: {} })], defs, {});
    expect(row(s, "vram_gb")?.cells[1]).toEqual({ kind: "none" });
    expect(row(s, "vram_gb")?.differs).toBe(true);
  });
  it("shows savings only where there are some", () => {
    const s = buildComparison([base({ savingsAmount: 10_00 }), base({})], defs, {});
    expect(row(s, "savings")?.cells.map((c) => c.kind)).toEqual(["money", "none"]);
  });
  it("one cell per product, in input order", () => {
    expect(row(sections, "price")?.cells).toEqual([
      { kind: "money", amount: 100_00 },
      { kind: "money", amount: 120_00 },
    ]);
  });
  it("returns nothing for nothing", () => {
    expect(buildComparison([], defs, {})).toEqual([]);
  });
});

const part = (
  categoryPath: string,
  title: string,
  specs: Record<string, unknown> = {},
  quantity = 1,
) => ({
  categoryPath,
  title: { en: title, ar: title },
  quantity,
  specs,
});

describe("buildComparison: bundles", () => {
  const b1 = base({
    type: "BUNDLE",
    warrantyMonths: 0,
    parts: [
      part("components/graphics-cards/nvidia", "GPU one"),
      part("components/cpus/amd", "CPU one"),
      part("components/memory", "RAM kit", { capacity_gb: 16, memory_type: "DDR4" }, 2),
    ],
  });
  const b2 = base({
    type: "BUNDLE",
    warrantyMonths: 0,
    parts: [
      part("components/cpus/amd", "CPU two"),
      part("components/storage/ssd", "SSD", { capacity_gb: 1000 }),
    ],
  });
  const sections = buildComparison([b1, b2], [], {
    "components/cpus/amd": { en: "Processor", ar: "المعالج" },
  });

  it("has a parts row per kind of component, build order (cpu before gpu)", () => {
    const parts = sections.find((s) => s.id === "parts");
    expect(parts?.rows.map((r) => r.id)).toEqual([
      "parts:components/cpus/amd",
      "parts:components/memory",
      "parts:components/graphics-cards/nvidia",
      "parts:components/storage/ssd",
    ]);
    expect(parts?.rows[0]?.label).toEqual({ en: "Processor", ar: "المعالج" });
  });
  it("lists quantities and shows an absent kind as no value", () => {
    const ram = row(sections, "parts:components/memory");
    expect(ram?.cells[0]).toEqual({
      kind: "list",
      items: [{ en: "RAM kit × 2", ar: "RAM kit × 2" }],
    });
    expect(ram?.cells[1]).toEqual({ kind: "none" });
  });
  it("never shows a single warranty for bundles", () => {
    expect(row(sections, "warranty")).toBeUndefined();
  });
  it("summarises memory (kits times capacity) and storage", () => {
    expect(row(sections, "memory")?.cells[0]).toEqual({ kind: "number", value: 32, unit: "gb" });
    expect(row(sections, "memory")?.cells[1]).toEqual({ kind: "none" });
    expect(row(sections, "storage")?.cells[1]).toEqual({ kind: "number", value: 1000, unit: "gb" });
  });
  it("has no spec rows for bundles", () => {
    expect(sections.some((s) => s.id === "specs")).toBe(false);
  });
});
