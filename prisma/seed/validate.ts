import { isValidSlug, SKU_PATTERN } from "@/domain/catalog";
import { buildSpecSchema, resolveSpecDefinitions, type SpecDef } from "@/domain/specs";
import { loadSeedData, type SeedData } from "./data";
import { branches } from "./data/branches";
import { promoCodes } from "./data/promo-codes";
import { governorates, shippingZones } from "./data/shipping-zones";
import { categoryDepth, categoryParentPath, categorySlug, productSlug, SEED_EPOCH } from "./derive";
import type { SeedProduct, ShowcaseSeed } from "./types";

export class SeedValidationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(
      `Seed data is invalid (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n- ${problems.join("\n- ")}`,
    );
    this.name = "SeedValidationError";
  }
}

const ARABIC = /[\u0600-\u06FF]/;
const TOKEN = /^[A-Za-z0-9 .+%\-/()]+$/;
const COLUMNS = new Set(["weightGrams", "lengthMm", "widthMm", "heightMm"]);
const EMBED_HOSTS = new Set(["www.youtube-nocookie.com"]);

/** Spec keys each build role must carry so the compatibility rules never report "unknown" for a seeded part. */
export const ROLE_REQUIRED_SPECS: Readonly<Record<string, readonly string[]>> = {
  "components/cpus": ["socket", "tdp_w"],
  "components/motherboards": [
    "socket",
    "form_factor",
    "memory_type",
    "memory_slots",
    "max_memory_gb",
    "m2_slots",
  ],
  "components/memory": ["memory_type", "capacity_gb", "modules"],
  "components/graphics-cards": ["tdp_w", "length_mm"],
  "components/power-supplies": ["wattage_w", "form_factor"],
  "components/cases": [
    "form_factors",
    "max_gpu_length_mm",
    "max_cooler_height_mm",
    "psu_form_factors",
  ],
  "components/storage": ["interface", "form_factor"],
};

export function validateSeedData(data: SeedData = loadSeedData()): string[] {
  const problems: string[] = [];
  const bad = (msg: string) => problems.push(msg);
  const ar = (where: string, text: string | undefined) => {
    if (text === undefined || ARABIC.test(text)) return;
    // Short Latin-only values are technical tokens or model names (AM5, DDR5, Intel Arc), the same in both languages.
    if (!(text.length <= 30 && TOKEN.test(text)))
      bad(`${where}: Arabic text has no Arabic letters`);
  };

  // categories
  const categories = new Map<string, (typeof data.categories)[number]>();
  for (const c of data.categories) {
    if (categories.has(c.path)) bad(`category "${c.path}" is declared twice`);
    const parent = categoryParentPath(c);
    if (parent && !categories.has(parent))
      bad(`category "${c.path}": parent "${parent}" must be declared before it`);
    if (categoryDepth(c) > 3) bad(`category "${c.path}" is deeper than 3 levels`);
    if (!isValidSlug(categorySlug(c))) bad(`category "${c.path}": invalid slug`);
    ar(`category ${c.path}`, c.name.ar);
    categories.set(c.path, c);
  }

  // brands and tags
  const brandSlugs = new Set<string>();
  for (const b of data.brands) {
    if (brandSlugs.has(b.slug)) bad(`brand "${b.slug}" is declared twice`);
    if (!isValidSlug(b.slug)) bad(`brand "${b.slug}": invalid slug`);
    if (b.website && !b.website.startsWith("https://"))
      bad(`brand "${b.slug}": website must be https`);
    brandSlugs.add(b.slug);
  }
  const tagSlugs = new Set<string>();
  for (const tg of data.tags) {
    if (tagSlugs.has(tg.slug)) bad(`tag "${tg.slug}" is declared twice`);
    if (!isValidSlug(tg.slug)) bad(`tag "${tg.slug}": invalid slug`);
    ar(`tag ${tg.slug}`, tg.name.ar);
    tagSlugs.add(tg.slug);
  }

  // spec definitions
  for (const [path, defs] of Object.entries(data.specDefinitions)) {
    if (!categories.has(path)) bad(`spec definitions: unknown category "${path}"`);
    try {
      buildSpecSchema(defs);
    } catch (err) {
      bad(`spec definitions for "${path}": ${(err as Error).message}`);
    }
    for (const d of defs) {
      ar(`spec ${path}.${d.key} label`, d.labelAr);
      if (d.filterable !== (d.facet !== "NONE"))
        bad(`spec ${path}.${d.key}: filterable must match facet`);
      for (const o of d.options ?? []) ar(`spec ${path}.${d.key} option ${o.value}`, o.labelAr);
    }
  }

  const checkShowcase = (where: string, blocks: readonly ShowcaseSeed[] | undefined) => {
    for (const [i, b] of (blocks ?? []).entries()) {
      const at = `${where} showcase #${i + 1}`;
      if (b.type === "VIDEO") {
        try {
          const url = new URL(b.videoUrl);
          if (url.protocol !== "https:" || !EMBED_HOSTS.has(url.hostname))
            bad(`${at}: video must be an https URL on an allowed embed host`);
        } catch {
          bad(`${at}: invalid video URL`);
        }
      }
      if (b.type === "IMAGE" || b.type === "IMAGE_TEXT") ar(`${at} alt`, b.alt.ar);
      if (b.type === "IMAGE_TEXT" || b.type === "FEATURE") {
        ar(`${at} title`, b.title.ar);
        ar(`${at} body`, b.body.ar);
      }
    }
  };

  // physical products
  const skus = new Set<string>();
  const slugs = new Set<string>();
  const physical = new Map<string, SeedProduct>();
  const checkIdentity = (kind: string, sku: string, slug: string) => {
    if (!SKU_PATTERN.test(sku)) bad(`${kind} ${sku}: invalid SKU`);
    if (skus.has(sku)) bad(`${kind} ${sku}: duplicate SKU`);
    if (!isValidSlug(slug)) bad(`${kind} ${sku}: invalid slug "${slug}"`);
    if (slugs.has(slug)) bad(`${kind} ${sku}: duplicate slug "${slug}"`);
    skus.add(sku);
    slugs.add(slug);
  };

  for (const p of data.products) {
    checkIdentity("product", p.sku, productSlug(p));
    physical.set(p.sku, p);
    if (!brandSlugs.has(p.brand)) bad(`product ${p.sku}: unknown brand "${p.brand}"`);
    const cat = categories.get(p.category);
    if (!cat) bad(`product ${p.sku}: unknown category "${p.category}"`);
    else if (cat.active === false) bad(`product ${p.sku}: category "${p.category}" is inactive`);
    if (p.category.startsWith("pc-bundles"))
      bad(`product ${p.sku}: physical products cannot live in pc-bundles`);
    for (const tg of p.tags) if (!tagSlugs.has(tg)) bad(`product ${p.sku}: unknown tag "${tg}"`);
    ar(`product ${p.sku} title`, p.title.ar);
    ar(`product ${p.sku} short`, p.short.ar);
    ar(`product ${p.sku} description`, p.description?.ar);
    if (!p.title.en.includes(p.model.split(" ")[0] ?? ""))
      bad(`product ${p.sku}: title does not mention the model`);
    if (!Number.isInteger(p.priceEgp) || p.priceEgp <= 0)
      bad(`product ${p.sku}: price must be a positive whole EGP amount`);
    if (p.compareAtEgp !== undefined && p.compareAtEgp <= p.priceEgp)
      bad(`product ${p.sku}: compare-at must exceed the price`);
    if (p.costEgp !== undefined && p.costEgp >= p.priceEgp)
      bad(`product ${p.sku}: cost must be below the price`);
    for (const [k, v] of Object.entries({
      stock: p.stock,
      views: p.views,
      sold: p.sold,
      warrantyMonths: p.warrantyMonths,
      addedDaysAgo: p.addedDaysAgo,
    }))
      if (!Number.isInteger(v) || v < 0)
        bad(`product ${p.sku}: ${k} must be a non-negative integer`);
    if ("ean" in p) bad(`product ${p.sku}: barcodes are never seeded`);
    if (p.mpn !== undefined && p.mpn.trim() === "") bad(`product ${p.sku}: empty MPN`);

    const defs = resolveSpecDefinitions<SpecDef>(p.category, data.specDefinitions);
    if (defs.length === 0) bad(`product ${p.sku}: no spec definitions for "${p.category}"`);
    else {
      const parsed = buildSpecSchema(defs).safeParse(p.specs);
      if (!parsed.success)
        for (const i of parsed.error.issues)
          bad(`product ${p.sku}: spec ${i.path.join(".") || "(root)"}: ${i.message}`);
      for (const k of p.verify?.keys ?? [])
        if (!(k in p.specs) && !COLUMNS.has(k))
          bad(`product ${p.sku}: verify lists "${k}", which is not one of its specs`);
    }
    const family = Object.keys(ROLE_REQUIRED_SPECS).find(
      (f) => p.category === f || p.category.startsWith(`${f}/`),
    );
    if (family)
      for (const k of ROLE_REQUIRED_SPECS[family] ?? [])
        if (!(k in p.specs)) bad(`product ${p.sku}: compatibility needs spec "${k}"`);
    if (p.category.startsWith("components/cooling") && !p.category.endsWith("case-fans")) {
      const type = p.specs["cooler_type"];
      if (!("sockets" in p.specs)) bad(`product ${p.sku}: coolers need "sockets"`);
      if (type === "air" && typeof p.specs["height_mm"] !== "number")
        bad(`product ${p.sku}: air coolers need "height_mm"`);
      if (type === "liquid" && typeof p.specs["radiator_mm"] !== "number")
        bad(`product ${p.sku}: liquid coolers need "radiator_mm"`);
    }
    if (p.verify && p.verify.note.trim() === "") bad(`product ${p.sku}: verify needs a note`);
    checkShowcase(`product ${p.sku}`, p.showcase);
  }

  // bundles
  for (const b of data.bundles) {
    checkIdentity("bundle", b.sku, productSlug(b));
    if (!categories.get(b.category) || !b.category.startsWith("pc-bundles/"))
      bad(`bundle ${b.sku}: category must be a pc-bundles sub-category`);
    for (const tg of b.tags) if (!tagSlugs.has(tg)) bad(`bundle ${b.sku}: unknown tag "${tg}"`);
    ar(`bundle ${b.sku} title`, b.title.ar);
    ar(`bundle ${b.sku} short`, b.short.ar);
    ar(`bundle ${b.sku} description`, b.description.ar);
    const seen = new Set<string>();
    let total = 0;
    for (const item of b.items) {
      const part = physical.get(item.sku);
      if (!part) bad(`bundle ${b.sku}: unknown component "${item.sku}"`);
      if (seen.has(item.sku)) bad(`bundle ${b.sku}: component "${item.sku}" listed twice`);
      seen.add(item.sku);
      const qty = item.quantity ?? 1;
      if (!Number.isInteger(qty) || qty < 1 || qty > 50)
        bad(`bundle ${b.sku}: quantity of "${item.sku}" must be 1 to 50`);
      total += (part?.priceEgp ?? 0) * qty;
    }
    if (b.items.length < 2) bad(`bundle ${b.sku}: needs at least two components`);
    const saving = total - b.fixedPriceEgp;
    if (saving <= 0)
      bad(`bundle ${b.sku}: price ${b.fixedPriceEgp} is not below the parts total ${total}`);
    else if (saving / total > 0.15)
      bad(
        `bundle ${b.sku}: discount of ${Math.round((saving / total) * 100)}% is unrealistically large`,
      );
    const defs = resolveSpecDefinitions<SpecDef>(b.category, data.specDefinitions);
    const parsed = buildSpecSchema(defs).safeParse(b.specs);
    if (!parsed.success)
      for (const i of parsed.error.issues)
        bad(`bundle ${b.sku}: spec ${i.path.join(".") || "(root)"}: ${i.message}`);
    checkShowcase(`bundle ${b.sku}`, b.showcase);
  }

  // data-only files
  const govCodes = new Set<string>();
  for (const g of governorates) {
    if (govCodes.has(g.code)) bad(`governorate "${g.code}" is declared twice`);
    ar(`governorate ${g.code}`, g.name.ar);
    govCodes.add(g.code);
  }
  if (govCodes.size !== 27) bad(`expected 27 governorates, found ${govCodes.size}`);
  const covered = new Map<string, string>();
  for (const z of shippingZones) {
    ar(`zone ${z.code}`, z.name.ar);
    if (z.feeEgp < 0 || z.etaDays.min < 1 || z.etaDays.max < z.etaDays.min)
      bad(`zone ${z.code}: invalid fee or delivery estimate`);
    for (const g of z.governorates) {
      if (!govCodes.has(g)) bad(`zone ${z.code}: unknown governorate "${g}"`);
      if (covered.has(g)) bad(`governorate "${g}" is in zones "${covered.get(g)}" and "${z.code}"`);
      covered.set(g, z.code);
    }
  }
  for (const g of govCodes)
    if (!covered.has(g)) bad(`governorate "${g}" is not in any shipping zone`);

  const codes = new Set<string>();
  for (const pc of promoCodes) {
    if (!/^[A-Z0-9]{4,20}$/.test(pc.code))
      bad(`promo "${pc.code}": codes are 4 to 20 upper-case letters or digits`);
    if (codes.has(pc.code)) bad(`promo "${pc.code}" is declared twice`);
    codes.add(pc.code);
    if (pc.kind === "PERCENT" && (pc.value < 1 || pc.value > 10_000))
      bad(`promo ${pc.code}: percent must be 1 to 10000 basis points`);
    if (pc.kind === "FIXED" && pc.value < 1) bad(`promo ${pc.code}: fixed amount must be positive`);
    const starts = Date.parse(pc.startsAt);
    const ends = pc.expiresAt === null ? null : Date.parse(pc.expiresAt);
    if (Number.isNaN(starts) || (ends !== null && Number.isNaN(ends)))
      bad(`promo ${pc.code}: invalid date`);
    else if (ends !== null && ends <= starts) bad(`promo ${pc.code}: expires before it starts`);
    const expired = ends !== null && ends < SEED_EPOCH.getTime();
    if ((pc.expectation === "expired") !== expired)
      bad(`promo ${pc.code}: expectation "${pc.expectation}" does not match its dates`);
    for (const path of pc.categoryPaths ?? [])
      if (!categories.has(path)) bad(`promo ${pc.code}: unknown category "${path}"`);
  }

  const branchCodes = new Set<string>();
  for (const br of branches) {
    if (branchCodes.has(br.code)) bad(`branch "${br.code}" is declared twice`);
    branchCodes.add(br.code);
    ar(`branch ${br.code} name`, br.name.ar);
    ar(`branch ${br.code} address`, br.address.ar);
    if (!govCodes.has(br.governorate))
      bad(`branch ${br.code}: unknown governorate "${br.governorate}"`);
    if (br.lat < 22 || br.lat > 32 || br.lng < 24 || br.lng > 37)
      bad(`branch ${br.code}: coordinates are outside Egypt`);
    if (!/^01\d[\s-]?\d{4}[\s-]?\d{4}$/.test(br.phone))
      bad(`branch ${br.code}: phone is not an Egyptian mobile number format`);
    for (const [day, h] of Object.entries(br.hours))
      if (
        h &&
        (!/^\d{2}:\d{2}$/.test(h.open) || !/^\d{2}:\d{2}$/.test(h.close) || h.open >= h.close)
      )
        bad(`branch ${br.code}: bad hours on day ${day}`);
  }

  return problems;
}

export function assertValidSeedData(data?: SeedData): void {
  const problems = validateSeedData(data);
  if (problems.length > 0) throw new SeedValidationError(problems);
}
