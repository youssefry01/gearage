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

  it("every Server Action in the auth and account features declares a rate-limit policy", () => {
    for (const file of [
      "src/features/auth/auth.actions.ts",
      "src/features/account/account.actions.ts",
    ]) {
      const src = readFileSync(join(root, file), "utf8");
      const actions = src.match(/export const \w+Action = /g) ?? [];
      const policies = src.match(/\.metadata\(\{ policy: /g) ?? [];
      expect(actions.length, file).toBeGreaterThanOrEqual(4);
      expect(policies, file).toHaveLength(actions.length);
    }
  });

  it("every account action is an authedAction: the session is proved before any work runs", () => {
    const src = readFileSync(join(root, "src/features/account/account.actions.ts"), "utf8");
    const actions = src.match(/export const \w+Action = (\w+)/g) ?? [];
    expect(actions.length).toBeGreaterThanOrEqual(4);
    for (const a of actions) expect(a, a).toMatch(/= authedAction$/);
  });

  it("the only public email-change action is the cancel link, and it has its own per-IP policy", () => {
    const src = readFileSync(join(root, "src/features/auth/auth.actions.ts"), "utf8");
    expect(src).toMatch(
      /export const cancelEmailChangeAction = publicAction\s*\.metadata\(\{ policy: policies\.emailChangeCancelIp\.name/,
    );
    const account = readFileSync(join(root, "src/features/account/account.actions.ts"), "utf8");
    expect(account).not.toMatch(/publicAction/);
  });

  it("email-change secrets are never selected or logged outside the service", () => {
    const repoSrc = readFileSync(
      join(root, "src/server/repositories/email-change.repository.ts"),
      "utf8",
    );
    expect(repoSrc).not.toMatch(/cancelHash\s*:\s*true/);
    const svc = readFileSync(join(root, "src/server/services/email-change.service.ts"), "utf8");
    expect(svc).not.toMatch(/logger\.\w+\([^)]*(code|token|newEmail|currentEmail)/);
  });

  it("the session token (the cookie secret) is never selected by the account repository", () => {
    const src = readFileSync(join(root, "src/server/repositories/account.repository.ts"), "utf8");
    expect(src).not.toMatch(/token\s*:\s*true/);
    expect(src).not.toMatch(/userAgent\s*:\s*true/);
    expect(src).not.toMatch(/ipAddress\s*:\s*true/);
  });
});
