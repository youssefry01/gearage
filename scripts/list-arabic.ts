/**
 * Generates docs/I18N_REVIEW.md: every machine-written Arabic string that needs native review, with its English
 * counterpart for context (UI messages, brand copy, category names).
 *   npm run i18n:review         rewrites the file
 *   npm run i18n:review:check   fails if the file is out of date (CI), like tokens:check
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { brand } from "../src/config/brand";
import { navCategories, type NavCategory } from "../src/features/navigation/categories";

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

function walk(nodes: NavCategory[], trail: string[] = []): string[] {
  return nodes.flatMap((n) => {
    const path = [...trail, n.slug].join("/");
    // names identical in both languages are brand/model names, not translations
    const own = n.name.en === n.name.ar ? [] : [row(`category: ${path}`, n.name.en, n.name.ar)];
    return [...own, ...walk(n.children ?? [], [...trail, n.slug])];
  });
}
const categories = walk(navCategories);
const count = messages.length + brandRows.length + categories.length;

const doc = `# Arabic copy that needs native review

${count} Arabic strings were written by the assistant, not a native copywriter. Review tone, terminology (Egyptian retail wording, for
example the category names) and plural forms. Brand and model names left in Latin (AMD Ryzen, DDR5, ...) are not listed.
The owner plans one native-review pass once more copy exists.

This file is GENERATED from \`messages/ar.json\`, \`src/config/brand.ts\` and the category tree. Do not edit it by hand:
run \`npm run i18n:review\` after adding strings (CI runs \`npm run i18n:review:check\`).

<!-- prettier-ignore-start -->

## UI messages

${[...header, ...messages].join("\n")}

## Brand copy

${[...header, ...brandRows].join("\n")}

## Category names (temporary static tree; moves to the database in M3a)

${[...header, ...categories].join("\n")}

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
