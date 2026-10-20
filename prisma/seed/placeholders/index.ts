import { loadSeedData, type SeedData } from "../data";
import { keys } from "../derive";
import { resolveSpecDefinitions, type SpecDef } from "@/domain/specs";
import type { SeedBundle, SeedProduct } from "../types";
import type { GlyphKind } from "./glyphs";
import { brandTile, categoryTile, productDetail, productMain, showcaseImage } from "./svg";

export type PlaceholderAsset = { key: string; svg: string };

const KIND_BY_PREFIX: readonly (readonly [string, GlyphKind])[] = [
  ["components/cpus", "cpu"],
  ["components/graphics-cards", "gpu"],
  ["components/motherboards", "board"],
  ["components/memory", "ram"],
  ["components/storage/hard-drives", "hdd"],
  ["components/storage", "ssd"],
  ["components/power-supplies", "psu"],
  ["components/cases", "tower"],
  ["components/cooling/air-coolers", "aircooler"],
  ["components/cooling/liquid-coolers", "aio"],
  ["components/cooling/case-fans", "fan"],
  ["components/cooling", "aircooler"],
  ["components", "cpu"],
  ["pc-bundles", "bundle"],
  ["laptops", "laptop"],
  ["monitors", "monitor"],
  ["peripherals/keyboards", "keyboard"],
  ["peripherals/mice", "mouse"],
  ["peripherals/headsets", "headset"],
  ["peripherals/webcams", "webcam"],
  ["peripherals", "keyboard"],
  ["networking/routers", "router"],
  ["networking/wifi-adapters", "card"],
  ["networking/network-switches", "switch"],
  ["networking", "router"],
  ["audio-streaming", "mic"],
  ["accessories/thermal-paste", "paste"],
  ["accessories/mouse-pads", "pad"],
  ["accessories", "paste"],
  ["gift-cards", "gift"],
];

/** The glyph that illustrates a category path (longest matching prefix wins; the list above is ordered that way). */
export function kindOfCategory(path: string): GlyphKind {
  const hit = KIND_BY_PREFIX.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return hit ? hit[1] : "bundle";
}

/** Up to three short "Label: value" chips for the second product image, in the order the specs are defined. */
function chipsOf(defs: readonly SpecDef[], specs: SeedProduct["specs"]): string[] {
  const out: string[] = [];
  for (const d of defs) {
    if (out.length === 3) break;
    const value = specs[d.key];
    if (value === undefined || typeof value === "boolean" || Array.isArray(value)) continue;
    const text = `${d.labelEn}: ${value}${d.unit ? ` ${d.unit}` : ""}`;
    if (text.length <= 34) out.push(text);
  }
  return out;
}

export const brandNameOf = (data: SeedData, slug: string): string =>
  data.brands.find((b) => b.slug === slug)?.name ?? slug;

/** Number of images every product has (also used for the ProductImage rows). */
export const PRODUCT_IMAGE_COUNT = 2;

export function productAssets(data: SeedData, p: SeedProduct): PlaceholderAsset[] {
  const kind = kindOfCategory(p.category);
  const brand = brandNameOf(data, p.brand);
  return [
    { key: keys.product(p.sku, 1), svg: productMain({ brand, model: p.model, kind }) },
    {
      key: keys.product(p.sku, 2),
      svg: productDetail({
        brand,
        model: p.model,
        kind,
        chips: chipsOf(resolveSpecDefinitions<SpecDef>(p.category, data.specDefinitions), p.specs),
      }),
    },
  ];
}

export function bundleAssets(b: SeedBundle): PlaceholderAsset[] {
  const kind = kindOfCategory(b.category);
  const brand = b.category.split("/")[1]?.replaceAll("-", " ") ?? "bundle";
  return [
    {
      key: keys.product(b.sku, 1),
      svg: productMain({ brand, model: b.title.en.split(":")[0] ?? b.title.en, kind }),
    },
    {
      key: keys.product(b.sku, 2),
      svg: productDetail({
        brand,
        model: b.title.en.split(":")[0] ?? b.title.en,
        kind,
        chips: [`${b.items.length} parts`, `Fixed bundle price`, "Parts-in-box"],
      }),
    },
  ];
}

/** Every generated image, deterministic (same input, same bytes), so re-seeding rewrites identical files. */
export function allPlaceholderAssets(data: SeedData = loadSeedData()): PlaceholderAsset[] {
  const assets: PlaceholderAsset[] = [];
  for (const c of data.categories)
    assets.push({
      key: keys.category(c.path),
      svg: categoryTile({ name: c.name.en, kind: kindOfCategory(c.path) }),
    });
  for (const b of data.brands) assets.push({ key: keys.brand(b.slug), svg: brandTile(b.name) });
  for (const p of data.products) {
    assets.push(...productAssets(data, p));
    (p.showcase ?? []).forEach((block, i) => {
      if (block.type === "IMAGE" || block.type === "IMAGE_TEXT")
        assets.push({
          key: keys.showcase(p.sku, i + 1),
          svg: showcaseImage({ kind: kindOfCategory(p.category), title: p.model, index: i }),
        });
    });
  }
  for (const b of data.bundles) {
    assets.push(...bundleAssets(b));
    (b.showcase ?? []).forEach((block, i) => {
      if (block.type === "IMAGE" || block.type === "IMAGE_TEXT")
        assets.push({
          key: keys.showcase(b.sku, i + 1),
          svg: showcaseImage({ kind: "bundle", title: b.title.en, index: i }),
        });
    });
  }
  return assets;
}
