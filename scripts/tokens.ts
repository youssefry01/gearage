import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderTokensCss } from "../src/design/css";

const target = resolve(process.cwd(), "src/styles/tokens.css");
const next = renderTokensCss();

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {
    // missing file counts as drift
  }
  if (current !== next) {
    console.error(
      "src/styles/tokens.css is out of date. Run `npm run tokens:build` and commit the result.",
    );
    process.exit(1);
  }
  console.log("tokens.css is up to date");
} else {
  writeFileSync(target, next);
  console.log("wrote src/styles/tokens.css");
}
