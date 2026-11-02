// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { assessPassword } from "./password-policy.service";

const ok = (count: number) => vi.fn(async () => ({ status: "ok" as const, count }));
const unknown = vi.fn(async () => ({ status: "unknown" as const }));

describe("assessPassword", () => {
  it("accepts a long-enough password that is not breached", async () => {
    expect(await assessPassword("correct horse battery", { checkBreached: ok(0) })).toEqual({
      ok: true,
      breachCheck: "checked",
    });
  });
  it("rejects ANY breach hit, however rare", async () => {
    expect(await assessPassword("correct horse battery", { checkBreached: ok(1) })).toEqual({
      ok: false,
      issue: "breached",
    });
  });
  it("rejects short and long passwords without asking the breach service", async () => {
    const spy = ok(0);
    expect(await assessPassword("short", { checkBreached: spy })).toEqual({
      ok: false,
      issue: "too_short",
    });
    expect(await assessPassword("x".repeat(129), { checkBreached: spy })).toEqual({
      ok: false,
      issue: "too_long",
    });
    expect(spy).not.toHaveBeenCalled();
  });
  it("FAILS OPEN when the breach service is unreachable, and says the check was skipped", async () => {
    expect(await assessPassword("correct horse battery", { checkBreached: unknown })).toEqual({
      ok: true,
      breachCheck: "skipped",
    });
  });
  it("applies no composition rules: all-lowercase, spaces and Arabic are fine", async () => {
    for (const p of ["alllowercaseletters", "with some spaces in it", "كلمة مرور عربية طويلة"]) {
      expect((await assessPassword(p, { checkBreached: ok(0) })).ok).toBe(true);
    }
  });
});
