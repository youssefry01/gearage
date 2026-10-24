import { describe, expect, it } from "vitest";
import { buildSpecRows, dimensionsMm, partAvailability, summarizeBuild } from "./product-page";
import type { SpecDef } from "./specs";

const def = (over: Partial<SpecDef> & Pick<SpecDef, "key" | "type">): SpecDef => ({
  labelEn: over.key,
  labelAr: `${over.key}-ar`,
  required: false,
  filterable: false,
  facet: "NONE",
  ...over,
});

describe("buildSpecRows", () => {
  const defs: SpecDef[] = [
    def({ key: "cores", type: "NUMBER", unit: null }),
    def({ key: "vram_gb", type: "NUMBER", unit: "GB" }),
    def({ key: "unlocked", type: "BOOLEAN" }),
    def({
      key: "socket",
      type: "ENUM",
      options: [{ value: "AM5", labelEn: "AM5", labelAr: "إيه إم 5" }],
    }),
    def({ key: "chipset", type: "STRING" }),
    def({ key: "sizes", type: "STRING_LIST" }),
  ];

  it("keeps the definition order and resolves enum labels in both languages", () => {
    const rows = buildSpecRows(defs, {
      sizes: ["120", "240"],
      socket: "AM5",
      vram_gb: 16,
      cores: 8,
      unlocked: false,
      chipset: "B650",
    });
    expect(rows.map((r) => r.key)).toEqual([
      "cores",
      "vram_gb",
      "unlocked",
      "socket",
      "chipset",
      "sizes",
    ]);
    expect(rows[1]?.display).toEqual({ kind: "number", value: 16, unit: "GB" });
    expect(rows[2]?.display).toEqual({ kind: "boolean", value: false });
    expect(rows[3]?.display).toEqual({ kind: "text", text: { en: "AM5", ar: "إيه إم 5" } });
    expect(rows[5]?.display).toEqual({ kind: "list", items: ["120", "240"] });
  });

  it("skips missing values, wrong types, unknown keys and blank strings; never prints raw junk", () => {
    const rows = buildSpecRows(defs, {
      cores: "eight",
      vram_gb: Number.NaN,
      unlocked: "yes",
      chipset: "  ",
      sizes: [1, null, ""],
      mystery: "x",
    });
    expect(rows).toEqual([]);
  });

  it("falls back to the raw value for an enum option that is no longer defined", () => {
    const rows = buildSpecRows(defs, { socket: "LGA9999" });
    expect(rows[0]?.display).toEqual({ kind: "text", text: { en: "LGA9999", ar: "LGA9999" } });
  });
});

describe("dimensionsMm", () => {
  it("needs all three sides", () => {
    expect(dimensionsMm({ weightGrams: 1, lengthMm: 10, widthMm: 20, heightMm: null })).toBeNull();
    expect(dimensionsMm({ weightGrams: null, lengthMm: 10, widthMm: 20, heightMm: 30 })).toEqual({
      length: 10,
      width: 20,
      height: 30,
    });
  });
});

describe("summarizeBuild", () => {
  it("multiplies kit capacity by the number of kits and adds drives", () => {
    const s = summarizeBuild([
      { role: "ram", quantity: 2, specs: { capacity_gb: 16, memory_type: "DDR5" } },
      { role: "storage", specs: { capacity_gb: 1000 } },
      { role: "storage", quantity: 2, specs: { capacity_gb: 500 } },
      { role: "psu", specs: { wattage_w: 750 } },
    ]);
    expect(s).toEqual({ memoryGb: 32, memoryType: "DDR5", storageGb: 2000, psuWatts: 750 });
  });

  it("is null, never a partial sum, when a needed spec is missing or the part is absent", () => {
    expect(
      summarizeBuild([
        { role: "storage", specs: { capacity_gb: 1000 } },
        { role: "storage", specs: {} },
      ]).storageGb,
    ).toBeNull();
    expect(summarizeBuild([])).toEqual({
      memoryGb: null,
      memoryType: null,
      storageGb: null,
      psuWatts: null,
    });
  });
});

describe("partAvailability", () => {
  const base = { status: "ACTIVE" as const, deleted: false, quantity: 2, available: 2 };
  it("is ok only when the stock covers the quantity in the bundle", () => {
    expect(partAvailability(base)).toBe("ok");
    expect(partAvailability({ ...base, available: 1 })).toBe("short");
    expect(partAvailability({ ...base, available: 0 })).toBe("short");
  });
  it("an archived, draft or deleted component is unavailable whatever its stock", () => {
    expect(partAvailability({ ...base, status: "ARCHIVED", available: 99 })).toBe("unavailable");
    expect(partAvailability({ ...base, status: "DRAFT" })).toBe("unavailable");
    expect(partAvailability({ ...base, deleted: true })).toBe("unavailable");
  });
});
