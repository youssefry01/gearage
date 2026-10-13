import { describe, expect, it } from "vitest";
import { AA, contrastRatio, parseHex, relativeLuminance } from "./contrast";
import { evaluatePairs } from "./evaluate";
import { brandColors, colorTokens, COLOR_TOKEN_NAMES, CONTRAST_PAIRS, THEMES } from "./tokens";

describe("contrast math", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
  });
  it("is symmetric", () => {
    expect(contrastRatio("#FF5A00", "#0D1114")).toBeCloseTo(
      contrastRatio("#0D1114", "#FF5A00"),
      10,
    );
  });
  it("rejects malformed colors", () => {
    expect(() => parseHex("#fff")).toThrow();
    expect(() => parseHex("orange")).toThrow();
  });
});

describe("design tokens", () => {
  it("brand colors are the approved values", () => {
    expect(brandColors).toEqual({ orange: "#FF5A00", ink: "#0D1114" });
    expect(colorTokens.dark.background).toBe(brandColors.ink);
  });
  it("every theme defines every token as a 6-digit hex", () => {
    for (const theme of THEMES) {
      expect(Object.keys(colorTokens[theme]).sort()).toEqual([...COLOR_TOKEN_NAMES].sort());
      for (const name of COLOR_TOKEN_NAMES)
        expect(colorTokens[theme][name]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
  it("documents why light text uses a darker orange: brand orange on white is below AA", () => {
    expect(contrastRatio(brandColors.orange, "#FFFFFF")).toBeLessThan(AA.text);
    expect(
      contrastRatio(colorTokens.light.link, colorTokens.light.background),
    ).toBeGreaterThanOrEqual(AA.text);
  });
  it("has no duplicate pairs", () => {
    const keys = CONTRAST_PAIRS.map((p) => `${p.fg}|${p.bg}|${p.use}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("WCAG AA gate", () => {
  it("every declared pair passes in every theme", () => {
    const failures = evaluatePairs().filter((r) => !r.pass);
    expect(failures.map((f) => `${f.theme}: ${f.fg}/${f.bg} ${f.ratio.toFixed(2)}`)).toEqual([]);
  });
  it("actually fails when a pair is below AA (the gate is not a no-op)", () => {
    const results = evaluatePairs([
      { fg: "background", bg: "card", kind: "text", use: "deliberately bad" },
    ]);
    expect(results.every((r) => !r.pass)).toBe(true);
  });
});
