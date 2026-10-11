import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { allBrandNames } from "../src/config/brand";
import {
  BINARY_EXT,
  findBrandViolations,
  isAllowedPath,
  SCAN_DIRS,
  SKIP_DIRS,
  type SourceFile,
} from "./lib/brand-check";

const root = process.cwd();

function walk(dir: string, out: SourceFile[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (!BINARY_EXT.test(entry.name)) {
      out.push({
        path: relative(root, full).replaceAll("\\", "/"),
        content: readFileSync(full, "utf8"),
      });
    }
  }
}

const files: SourceFile[] = [];
for (const dir of SCAN_DIRS) {
  try {
    walk(join(root, dir), files);
  } catch {
    // directory may not exist yet
  }
}

const violations = findBrandViolations(files, allBrandNames(), isAllowedPath);
if (violations.length > 0) {
  console.error(
    "Hardcoded store name found. Use src/config/brand.ts or a {brand} placeholder in messages:\n",
  );
  for (const v of violations) console.error(`  ${v.path}:${v.line}  ${v.text}`);
  process.exit(1);
}
console.log(`brand check passed (${files.length} files scanned)`);
