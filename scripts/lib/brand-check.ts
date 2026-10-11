export type SourceFile = { path: string; content: string };
export type Violation = { path: string; line: number; text: string };

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Finds hardcoded store names. Case-insensitive and substring-based, so `GearName`-style identifiers, split
 * markup and lowercase slugs are caught too. `isAllowed` exempts the brand config, messages and docs.
 */
export function findBrandViolations(
  files: readonly SourceFile[],
  names: readonly string[],
  isAllowed: (path: string) => boolean,
): Violation[] {
  const usable = names.map((n) => n.trim()).filter(Boolean);
  if (usable.length === 0)
    throw new Error("No brand names to check for; is src/config/brand.ts empty?");
  const pattern = new RegExp(usable.map(escapeRegExp).join("|"), "i");
  const violations: Violation[] = [];
  for (const file of files) {
    if (isAllowed(file.path)) continue;
    file.content.split(/\r?\n/).forEach((text, i) => {
      if (pattern.test(text))
        violations.push({ path: file.path, line: i + 1, text: text.trim().slice(0, 120) });
    });
  }
  return violations;
}

/** Scope: code, tests, scripts, seeds and public assets. Infra identifiers (package name, DB credentials) are out of scope. */
export const SCAN_DIRS = ["src", "tests", "scripts", "prisma", "public"] as const;
export const SKIP_DIRS = new Set(["node_modules", ".next", "generated", "migrations"]);
export const BINARY_EXT = /\.(png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|psd|pdf|mp4|webm)$/i;

export const isAllowedPath = (path: string): boolean => {
  const p = path.replaceAll("\\", "/");
  return p === "src/config/brand.ts" || p.startsWith("messages/") || p.startsWith("docs/");
};
