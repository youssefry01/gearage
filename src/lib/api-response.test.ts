import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fail, handle, ok } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

describe("api-response", () => {
  it("wraps success in { ok: true, data } with no-store", async () => {
    const res = ok({ a: 1 });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, data: { a: 1 } });
  });

  it("serializes AppError with its status", async () => {
    const res = fail(new AppError("FORBIDDEN", "nope"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: { code: "FORBIDDEN", message: "nope" } });
  });

  it("turns ZodError into VALIDATION_FAILED with issues", async () => {
    const parsed = z.object({ n: z.number() }).safeParse({ n: "x" });
    if (parsed.success) throw new Error("expected failure");
    const res = fail(parsed.error);
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string; details: unknown[] } };
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details).toHaveLength(1);
  });

  it("hides internals of unknown errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = fail(new Error("db password is hunter2"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
  });

  it("handle() converts thrown errors", async () => {
    const res = await handle(async () => {
      throw new AppError("NOT_FOUND", "gone");
    })();
    expect(res.status).toBe(404);
  });
});
