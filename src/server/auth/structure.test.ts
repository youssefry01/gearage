import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("auth structure (ADR 0002)", () => {
  it("does not mount Better Auth's HTTP handler: every flow goes through our rate-limited Server Actions", () => {
    expect(existsSync(join(root, "src/app/api/auth"))).toBe(false);
    const handlers = walk(join(root, "src")).filter((f) =>
      /toNextJsHandler|auth\.handler\(/.test(readFileSync(f, "utf8")),
    );
    expect(handlers.filter((f) => !f.endsWith("structure.test.ts"))).toEqual([]);
  });

  it("imports better-auth only in src/server/auth/auth.ts", () => {
    const offenders = walk(join(root, "src"))
      .filter((f) => !f.endsWith(".test.ts"))
      .filter((f) => /from "(better-auth|@better-auth)[^"]*"/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(root.length + 1).replaceAll("\\", "/"));
    expect(offenders).toEqual(["src/server/auth/auth.ts"]);
  });

  it("every auth Server Action declares a rate-limit policy", () => {
    const src = readFileSync(join(root, "src/features/auth/auth.actions.ts"), "utf8");
    const actions = src.match(/export const \w+Action = /g) ?? [];
    const policies = src.match(/\.metadata\(\{ policy: /g) ?? [];
    expect(actions.length).toBeGreaterThanOrEqual(5);
    expect(policies).toHaveLength(actions.length);
  });
});
