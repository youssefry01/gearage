import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { allBrandNames, brand, brandVars, localized, storeName } from "./brand";

describe("brand config", () => {
  it("falls back to English when a locale has no entry", () => {
    expect(storeName("ar")).toBe(storeName("en"));
    expect(localized({ en: "a", ar: "b" }, "ar")).toBe("b");
    expect(localized({ en: "a" }, "ar")).toBe("a");
  });
  it("exposes brand and tagline for message interpolation", () => {
    expect(brandVars("en")).toEqual({ brand: storeName("en"), tagline: brand.tagline.en });
    expect(brandVars("ar").tagline).toBe(brand.tagline.ar);
  });
  it("lists every name spelling for the CI check", () => {
    expect(allBrandNames()).toContain(storeName("en"));
  });
  it("has complete SEO text in both launch locales", () => {
    for (const l of ["en", "ar"] as const) {
      expect(localized(brand.seo.title, l).length).toBeGreaterThan(5);
      expect(localized(brand.seo.description, l).length).toBeGreaterThan(40);
    }
  });
});

describe("logo files", () => {
  const pngSize = (file: string) => {
    const buf = readFileSync(file);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  };
  for (const [variant, pair] of Object.entries(brand.logo)) {
    for (const [theme, asset] of Object.entries(pair)) {
      it(`${variant}/${theme} exists in public/ with the configured dimensions`, () => {
        const file = resolve(process.cwd(), "public", asset.src.replace(/^\//, ""));
        expect(existsSync(file)).toBe(true);
        expect(pngSize(file)).toEqual({ width: asset.width, height: asset.height });
      });
    }
  }
  it("ships the Open Graph image at the configured size", () => {
    const file = resolve(process.cwd(), "public", brand.ogImage.src.replace(/^\//, ""));
    expect(pngSize(file)).toEqual({ width: brand.ogImage.width, height: brand.ogImage.height });
  });
  it("ships the vector icon in both variants", () => {
    for (const f of ["logo-icon-on-dark.svg", "logo-icon-on-light.svg"]) {
      expect(existsSync(resolve(process.cwd(), "public/brand", f))).toBe(true);
    }
  });
});
