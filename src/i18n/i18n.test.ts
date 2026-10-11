import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { interpolateBrand } from "./brand-messages";
import { formats } from "./formats";
import { defaultLocale, directionOf, locales, nativeNameOf, ogLocaleOf } from "./locales";
import { brandVars } from "@/config/brand";

const dir = resolve(process.cwd(), "messages");
type Tree = { [k: string]: string | Tree };
const load = (l: string): Tree =>
  JSON.parse(readFileSync(resolve(dir, `${l}.json`), "utf8")) as Tree;

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? { ...acc, [key]: v } : { ...acc, ...flatten(v, key) };
  }, {});
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

describe("message files", () => {
  it("has exactly one file per registered locale", () => {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
    expect(files.sort()).toEqual([...locales].sort());
  });

  const base = flatten(load(defaultLocale));
  it.each(locales.filter((l) => l !== defaultLocale))(
    "%s has the same keys as the default locale",
    (l) => {
      expect(Object.keys(flatten(load(l))).sort()).toEqual(Object.keys(base).sort());
    },
  );
  it.each(locales)("%s has no empty messages and consistent placeholders", (l) => {
    const flat = flatten(load(l));
    for (const [key, value] of Object.entries(flat)) {
      expect(value.trim(), `${l}:${key} is empty`).not.toBe("");
      expect(placeholders(value), `${l}:${key} placeholders differ from ${defaultLocale}`).toEqual(
        placeholders(base[key] ?? ""),
      );
    }
  });
  it.each(locales)("%s resolves every {brand}/{tagline} placeholder", (l) => {
    const resolved = JSON.stringify(interpolateBrand(load(l), brandVars(l)));
    expect(resolved).not.toContain("{brand}");
    expect(resolved).not.toContain("{tagline}");
  });
});

describe("interpolateBrand", () => {
  it("replaces brand placeholders deeply and leaves other ICU placeholders", () => {
    const out = interpolateBrand(
      { a: { b: "Hi {brand}: {tagline} {count}" } },
      { brand: "X", tagline: "Y" },
    );
    expect(out).toEqual({ a: { b: "Hi X: Y {count}" } });
  });
});

describe("locale registry", () => {
  it("is English-first with Arabic as RTL", () => {
    expect(defaultLocale).toBe("en");
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("en")).toBe("ltr");
    expect(directionOf("ar-EG")).toBe("rtl");
  });
  it("derives native names and OG locales", () => {
    expect(nativeNameOf("en")).toBe("English");
    expect(nativeNameOf("ar")).toMatch(/[\u0600-\u06FF]/);
    expect(ogLocaleOf("ar")).toBe("ar_EG");
  });
});

describe("number formats", () => {
  it("keeps Western digits for Arabic (ADR 0006)", () => {
    const text = new Intl.NumberFormat("ar", formats.number.egp).format(48500);
    expect(text).toMatch(/48,500/);
    expect(text).not.toMatch(/[\u0660-\u0669]/);
  });
});
