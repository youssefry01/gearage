/**
 * Prints every Arabic string that needs native review, as Markdown, with its English counterpart for context:
 * UI messages (messages/ar.json), brand copy (src/config/brand.ts) and category names (navigation data).
 * Run `npm run i18n:review` and paste the output into HANDOFF.md ("Needs native review") after adding strings.
 */
import { readFileSync } from "node:fs";
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
    // names that are identical in both languages are brand/model names, not translations
    const own = n.name.en === n.name.ar ? [] : [row(`category: ${path}`, n.name.en, n.name.ar)];
    return [...own, ...walk(n.children ?? [], [...trail, n.slug])];
  });
}

const count = messages.length + brandRows.length + walk(navCategories).length;
console.log(`${count} Arabic strings need native review.\n`);
console.log("### UI messages\n", [...header, ...messages].join("\n"), "\n");
console.log("### Brand copy\n", [...header, ...brandRows].join("\n"), "\n");
console.log(
  "### Category names (temporary static tree; moves to the database in M3a)\n",
  [...header, ...walk(navCategories)].join("\n"),
);
