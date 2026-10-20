import { describe, expect, it, vi } from "vitest";
import { roleOfCategoryPath } from "@/domain/compatibility";
import { fromPounds } from "@/domain/money";
import { resolveSpecDefinitions, type SpecDef } from "@/domain/specs";
import type { StorageProvider } from "@/server/storage";
import { loadSeedData, type SeedData } from "./data";
import { branches } from "./data/branches";
import { promoCodes } from "./data/promo-codes";
import { governorates, shippingZones } from "./data/shipping-zones";
import { costOf, createdAtFor, keys, priceOf, productSlug } from "./derive";
import { allPlaceholderAssets, kindOfCategory } from "./placeholders";
import { wrap } from "./placeholders/svg";
import { runSeed } from "./run";
import { assertValidSeedData, SeedValidationError, validateSeedData } from "./validate";

const data = loadSeedData();
const clone = (): SeedData => structuredClone(data) as SeedData;

describe("seed data", () => {
  it("is valid", () => {
    expect(validateSeedData(data)).toEqual([]);
  });

  it("has the volumes the brief asks for", () => {
    expect(data.products.length).toBeGreaterThanOrEqual(60);
    expect(data.products.length).toBeLessThanOrEqual(80);
    expect(data.bundles.length).toBeGreaterThanOrEqual(5);
    expect(data.bundles.length).toBeLessThanOrEqual(8);
    expect(data.brands.length).toBeGreaterThanOrEqual(15);
    expect(data.brands.length).toBeLessThanOrEqual(25);
    expect(data.categories.filter((c) => !c.path.includes("/")).length).toBeGreaterThanOrEqual(8);
  });

  it("covers every top-level category with at least one product, except the reserved gift-cards", () => {
    const tops = data.categories.filter((c) => !c.path.includes("/") && c.active !== false);
    for (const top of tops) {
      const n =
        data.products.filter(
          (p) => p.category.startsWith(`${top.path}/`) || p.category === top.path,
        ).length + data.bundles.filter((b) => b.category.startsWith(`${top.path}/`)).length;
      expect(n, top.path).toBeGreaterThan(0);
    }
    expect(data.categories.find((c) => c.path === "gift-cards")?.active).toBe(false);
  });

  it("every leaf category that can hold products has some (no empty tiles in the menu)", () => {
    const leaves = data.categories.filter(
      (c) => c.active !== false && !data.categories.some((o) => o.path.startsWith(`${c.path}/`)),
    );
    for (const leaf of leaves) {
      const n =
        data.products.filter((p) => p.category === leaf.path).length +
        data.bundles.filter((b) => b.category === leaf.path).length;
      expect(n, leaf.path).toBeGreaterThan(0);
    }
  });

  it("uses unique SKUs, slugs and storage keys", () => {
    const skus = [...data.products, ...data.bundles].map((p) => p.sku);
    expect(new Set(skus).size).toBe(skus.length);
    const slugs = [...data.products, ...data.bundles].map(productSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const assetKeys = allPlaceholderAssets(data).map((a) => a.key);
    expect(new Set(assetKeys).size).toBe(assetKeys.length);
  });

  it("never seeds barcodes, and keeps MPNs to the products that have one", () => {
    for (const p of data.products) expect("ean" in p).toBe(false);
    expect(data.products.filter((p) => p.mpn).length).toBeLessThan(data.products.length / 2);
  });

  it("includes products of both generations and a spread of prices", () => {
    expect(data.products.filter((p) => p.tags.includes("previous-gen")).length).toBeGreaterThan(5);
    const prices = data.products.map((p) => p.priceEgp);
    expect(Math.max(...prices) / Math.min(...prices)).toBeGreaterThan(50);
  });

  it("derives piastres from whole-EGP prices and a default cost below the price", () => {
    for (const p of data.products) {
      expect(priceOf(p) % 100).toBe(0);
      expect(costOf(p)).toBeLessThan(priceOf(p));
      expect(priceOf(p)).toBe(fromPounds(p.priceEgp));
    }
  });

  it("gives every case fan no build role but every other cooling part one", () => {
    for (const p of data.products.filter((x) => x.category.startsWith("components/cooling"))) {
      expect(roleOfCategoryPath(p.category) === null).toBe(p.category.endsWith("case-fans"));
    }
  });

  it("resolves definitions for every product (nearest ancestor)", () => {
    for (const p of data.products)
      expect(
        resolveSpecDefinitions<SpecDef>(p.category, data.specDefinitions).length,
        p.sku,
      ).toBeGreaterThan(0);
  });

  it("derives bundle prices below the parts total with a believable discount", () => {
    for (const b of data.bundles) {
      const total = b.items.reduce(
        (n, i) =>
          n + (data.products.find((p) => p.sku === i.sku)?.priceEgp ?? 0) * (i.quantity ?? 1),
        0,
      );
      expect(b.fixedPriceEgp, b.sku).toBeLessThan(total);
      expect(b.fixedPriceEgp / total, b.sku).toBeGreaterThan(0.85);
    }
  });

  it("is deterministic: the same date for the same offset", () => {
    expect(createdAtFor(10).toISOString()).toBe(createdAtFor(10).toISOString());
    expect(createdAtFor(10).getTime()).toBeLessThan(createdAtFor(5).getTime());
  });
});

describe("seed validation catches mistakes", () => {
  const problemsOf = (mutate: (d: SeedData) => void): string[] => {
    const d = clone();
    mutate(d);
    return validateSeedData(d);
  };

  it("duplicate SKU", () => {
    const found = problemsOf((d) => {
      (d.products as unknown as { sku: string }[])[1]!.sku = (d.products[0] as { sku: string }).sku;
    });
    expect(found.join()).toMatch(/duplicate SKU/);
  });

  it("unknown brand, category and tag", () => {
    const found = problemsOf((d) => {
      const p = d.products[0] as unknown as { brand: string; category: string; tags: string[] };
      p.brand = "nope";
      p.category = "components/nowhere";
      p.tags = ["not-a-tag"];
    });
    const text = found.join("\n");
    expect(text).toMatch(/unknown brand/);
    expect(text).toMatch(/unknown category/);
    expect(text).toMatch(/unknown tag/);
  });

  it("a spec value that breaks its definition, or a missing required spec", () => {
    const found = problemsOf((d) => {
      const p = d.products.find((x) => x.sku === "CPU-AMD-R5-5600") as {
        specs: Record<string, unknown>;
      };
      p.specs["socket"] = "AM9";
      delete p.specs["tdp_w"];
    });
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  it("a bundle that costs more than its parts, or lists an unknown component", () => {
    const found = problemsOf((d) => {
      const b = d.bundles[0] as unknown as { fixedPriceEgp: number; items: { sku: string }[] };
      b.fixedPriceEgp = 999_999;
      b.items = [...b.items, { sku: "NOPE" }];
    });
    const text = found.join("\n");
    expect(text).toMatch(/not below the parts total/);
    expect(text).toMatch(/unknown component/);
  });

  it("compare-at below the price and Arabic text missing", () => {
    const found = problemsOf((d) => {
      const p = d.products[0] as { compareAtEgp?: number; priceEgp: number; short: { ar: string } };
      p.compareAtEgp = p.priceEgp - 1;
      p.short.ar = "This is English text pretending to be Arabic";
    });
    const text = found.join("\n");
    expect(text).toMatch(/compare-at/);
    expect(text).toMatch(/no Arabic letters/);
  });

  it("assertValidSeedData throws one error listing every problem", () => {
    const d = clone();
    (d.products[0] as { brand: string }).brand = "nope";
    expect(() => assertValidSeedData(d)).toThrow(SeedValidationError);
  });
});

describe("data-only files", () => {
  it("cover all 27 governorates exactly once", () => {
    expect(governorates).toHaveLength(27);
    const covered = shippingZones.flatMap((z) => z.governorates);
    expect(new Set(covered).size).toBe(27);
    expect(covered).toHaveLength(27);
  });

  it("have promo codes for each case a tester needs", () => {
    expect(new Set(promoCodes.map((c) => c.expectation))).toEqual(
      new Set(["valid", "expired", "limited"]),
    );
    expect(promoCodes.some((c) => c.kind === "PERCENT")).toBe(true);
    expect(promoCodes.some((c) => c.kind === "FIXED")).toBe(true);
    expect(promoCodes.some((c) => c.categoryPaths)).toBe(true);
  });

  it("have fictional branches only", () => {
    expect(branches.length).toBeGreaterThanOrEqual(3);
    for (const b of branches) expect(b.name.en.toLowerCase()).toContain("sample");
  });
});

describe("placeholder images", () => {
  const assets = allPlaceholderAssets(data);

  it("are deterministic: generating twice gives identical bytes", () => {
    expect(allPlaceholderAssets(data)).toEqual(assets);
  });

  it("are well-formed, labelled SVG with an accessible name and no scripts", () => {
    for (const a of assets) {
      expect(a.svg.startsWith("<svg "), a.key).toBe(true);
      expect(a.svg.trimEnd().endsWith("</svg>"), a.key).toBe(true);
      expect(a.svg, a.key).toContain('role="img"');
      expect(a.svg, a.key).toMatch(/aria-label="[^"]+"/);
      expect(a.svg.toLowerCase(), a.key).not.toMatch(/<script|onload=|javascript:|<image|href=/);
      expect(a.key, a.key).toMatch(/^seed\/[a-z0-9._/-]+\.svg$/);
    }
  });

  it("mark every product image as a placeholder, and stay small", () => {
    for (const a of assets.filter((x) => x.key.startsWith("seed/products/")))
      expect(a.svg, a.key).toContain("ILLUSTRATIVE PLACEHOLDER");
    expect(Math.max(...assets.map((a) => a.svg.length))).toBeLessThan(8_000);
  });

  it("escapes text coming from product names", () => {
    const evil = allPlaceholderAssets({
      ...data,
      products: [{ ...(data.products[0] as (typeof data.products)[number]), model: 'A<b>"&' }],
      bundles: [],
    });
    const main = evil.find((a) => a.key.endsWith("-1.svg") && a.key.includes("products"));
    expect(main?.svg).toContain("A&lt;b&gt;&quot;&amp;");
  });

  it("pick a glyph for every category", () => {
    for (const c of data.categories) expect(kindOfCategory(c.path)).toBeTruthy();
    expect(kindOfCategory("components/cooling/case-fans")).toBe("fan");
    expect(kindOfCategory("components/storage/hard-drives")).toBe("hdd");
  });

  it("wrap keeps lines short and cuts the last one with an ellipsis", () => {
    expect(wrap("one two three", 20, 2)).toEqual(["one two three"]);
    const lines = wrap("a very long product name that keeps going and going forever", 14, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith("\u2026")).toBe(true);
    expect(keys.product("ABC-1", 2)).toBe("seed/products/abc-1-2.svg");
  });
});

describe("the seed refuses to touch a non-local database", () => {
  it("throws before writing any file", async () => {
    const put = vi.fn();
    const storage = {
      put,
      exists: vi.fn(),
      delete: vi.fn(),
      urlFor: vi.fn(),
    } as unknown as StorageProvider;
    await expect(
      runSeed({
        storage,
        env: { DATABASE_URL: "postgresql://u:p@db.abcdefgh.supabase.co:5432/postgres" },
      }),
    ).rejects.toThrow(/local|refus/i);
    expect(put).not.toHaveBeenCalled();
  });
});
