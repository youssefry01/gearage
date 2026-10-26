/**
 * Generates docs/I18N_REVIEW.md: every machine-written Arabic string that needs native review, with its English
 * counterpart for context (UI messages, brand copy, search synonyms, category names).
 *   npm run i18n:review         rewrites the file
 *   npm run i18n:review:check   fails if the file is out of date (CI), like tokens:check
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { brand } from "../src/config/brand";
import { SYNONYM_GROUPS } from "../src/domain/search-synonyms";
import { loadSeedData } from "../prisma/seed/data";
import { governorates, shippingZones } from "../prisma/seed/data/shipping-zones";

type Tree = { [k: string]: string | Tree };
const load = (l: string): Tree =>
  JSON.parse(readFileSync(resolve(process.cwd(), `messages/${l}.json`), "utf8")) as Tree;

function flatten(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? [[key, v] as [string, string]] : flatten(v, key);
  });
}
const cell = (s: string) => s.replaceAll("|", "\\|").replaceAll("\n", " ");
const row = (where: string, en: string, ar: string) =>
  `| ${cell(where)} | ${cell(en)} | ${cell(ar)} |`;
const header = ["| Where | English | Arabic (machine-written) |", "| --- | --- | --- |"];

const en = new Map(flatten(load("en")));
const messages = flatten(load("ar")).map(([k, ar]) => row(`messages: ${k}`, en.get(k) ?? "", ar));

const brandRows = [
  row("brand: tagline", brand.tagline.en, brand.tagline.ar ?? ""),
  row("brand: seo.title", brand.seo.title.en, brand.seo.title.ar ?? ""),
  row("brand: seo.description", brand.seo.description.en, brand.seo.description.ar ?? ""),
];

// Search synonyms: the Arabic words shoppers type for a product type, brand or unit (src/domain/search-synonyms.ts).
const isArabic = (t: string) => /[\u0600-\u06FF]/.test(t);
const synonymRows = SYNONYM_GROUPS.map((g) =>
  row(
    `search synonyms: ${g.id}`,
    g.terms.filter((t) => !isArabic(t)).join(", "),
    g.terms.filter(isArabic).join("، "),
  ),
);

// Category names come from the seed (the storefront menu is served from those database rows since M3a).
const categories: string[] = [];

// Seed catalog copy (prisma/seed): everything a shopper reads that the seed writes in Arabic.
const seed = loadSeedData();
const same = (a: string, b: string) => a === b;
const seedCategories = seed.categories
  .filter((c) => !same(c.name.en, c.name.ar))
  .map((c) => row(`seed category: ${c.path}`, c.name.en, c.name.ar));
const seedCategoryDescriptions = seed.categories.flatMap((c) =>
  c.description
    ? [row(`seed category description: ${c.path}`, c.description.en, c.description.ar)]
    : [],
);
const seedTags = seed.tags
  .filter((tg) => !same(tg.name.en, tg.name.ar))
  .map((tg) => row(`tag: ${tg.slug}`, tg.name.en, tg.name.ar));
const specLabels = new Map<string, string>();
for (const defs of Object.values(seed.specDefinitions))
  for (const d of defs) {
    specLabels.set(`${d.labelEn}\u0000${d.labelAr}`, `spec label`);
    for (const o of d.options ?? [])
      if (!same(o.labelEn, o.labelAr))
        specLabels.set(`${o.labelEn}\u0000${o.labelAr}`, `spec option`);
  }
const seedSpecs = [...specLabels].map(([k, kind]) => {
  const [en, ar] = k.split("\u0000") as [string, string];
  return row(kind, en, ar);
});
const seedShipping = [
  ...governorates.map((g) => row(`governorate: ${g.code}`, g.name.en, g.name.ar)),
  ...shippingZones.map((z) => row(`shipping zone: ${z.code}`, z.name.en, z.name.ar)),
];
const seedBundles = seed.bundles.flatMap((b) => [
  row(`bundle ${b.sku}: title`, b.title.en, b.title.ar),
  row(`bundle ${b.sku}: short`, b.short.en, b.short.ar),
  row(`bundle ${b.sku}: description`, b.description.en, b.description.ar),
]);
const seedProducts = seed.products.flatMap((p) => [
  row(`${p.sku}: title`, p.title.en, p.title.ar),
  row(`${p.sku}: short`, p.short.en, p.short.ar),
  ...(p.description ? [row(`${p.sku}: description`, p.description.en, p.description.ar)] : []),
]);
const seedCount =
  seedCategories.length +
  seedCategoryDescriptions.length +
  seedTags.length +
  seedSpecs.length +
  seedShipping.length +
  seedBundles.length +
  seedProducts.length;
const count =
  messages.length + brandRows.length + synonymRows.length + categories.length + seedCount;

const doc = `# Arabic copy that needs native review

${count} Arabic strings were written by the assistant, not a native copywriter. Review tone, terminology (Egyptian retail wording, for
example the category names) and plural forms. Brand and model names left in Latin (AMD Ryzen, DDR5, ...) are not listed.
The owner plans one native-review pass once more copy exists.

This file is GENERATED from \`messages/ar.json\`, \`src/config/brand.ts\`, the category tree and the search synonym dictionary (\`src/domain/search-synonyms.ts\`) and the seed data files (\`prisma/seed/data\`). Do not edit it by hand:
run \`npm run i18n:review\` after adding strings (CI runs \`npm run i18n:review:check\`).

<!-- prettier-ignore-start -->

## UI messages

${[...header, ...messages].join("\n")}

## Brand copy

${[...header, ...brandRows].join("\n")}

## Search synonyms (the Arabic words that find a product type, brand or unit; one row per group)

Wrong or missing entries here mean a shopper who types that word gets no results or the wrong ones. Plurals, spelling
variants and Egyptian colloquial forms are the most valuable additions.

${[...header, ...synonymRows].join("\n")}

## Category names (temporary static tree; moves to the database in M3a)

${[...header, ...categories].join("\n")}

## Seed catalog: category names, descriptions and tags

${[...header, ...seedCategories, ...seedCategoryDescriptions, ...seedTags].join("\n")}

## Seed catalog: spec labels and options

${[...header, ...seedSpecs].join("\n")}

## Seed data: governorates and shipping zones (inserted from M6a)

${[...header, ...seedShipping].join("\n")}

## Seed catalog: bundles

${[...header, ...seedBundles].join("\n")}

## Seed catalog: products (titles and descriptions)

${[...header, ...seedProducts].join("\n")}

<!-- prettier-ignore-end -->
`;

const target = resolve(process.cwd(), "docs/I18N_REVIEW.md");
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {
    // a missing file counts as drift
  }
  if (current !== doc) {
    console.error(
      "docs/I18N_REVIEW.md is out of date. Run `npm run i18n:review` and commit the result.",
    );
    process.exit(1);
  }
  console.log(`docs/I18N_REVIEW.md is up to date (${count} strings)`);
} else {
  writeFileSync(target, doc);
  console.log(`wrote docs/I18N_REVIEW.md (${count} strings)`);
}
