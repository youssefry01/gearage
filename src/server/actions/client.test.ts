// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { policies } from "@/domain/rate-limit";
import { AppError } from "@/lib/errors";

const hit = vi.fn();
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/security/rate-limit/limiter", () => ({ getLimiter: () => ({ hit }) }));

const { publicAction } = await import("./client");

const echo = publicAction
  .metadata({ policy: policies.loginIp.name })
  .inputSchema(z.object({ n: z.number() }))
  .action(async ({ parsedInput }) => ({ doubled: parsedInput.n * 2 }));

const boom = publicAction
  .metadata({ policy: policies.searchSuggest.name })
  .inputSchema(z.object({ kind: z.enum(["app", "bug"]) }))
  .action(async ({ parsedInput }) => {
    if (parsedInput.kind === "app") throw new AppError("CONFLICT", "Already exists");
    throw new Error("secret internal detail: password=hunter2");
  });

beforeEach(() => hit.mockReset());

describe("publicAction", () => {
  it("runs the action when the policy allows it, and passes the policy it declared", async () => {
    hit.mockResolvedValue({ allowed: true, retryAfterSec: 0, unavailable: false });
    expect(await echo({ n: 4 })).toEqual({ data: { doubled: 8 } });
    expect(hit.mock.calls[0]?.[0]).toMatchObject({ name: "auth.login.ip", failMode: "closed" });
  });
  it("refuses BEFORE validating input or running anything when the limit is exceeded", async () => {
    hit.mockResolvedValue({ allowed: false, retryAfterSec: 90, unavailable: false });
    const result = await echo({ n: "not a number" } as never);
    expect(result.serverError).toEqual({
      code: "RATE_LIMITED",
      message: "Too many attempts. Try again later.",
      retryAfterSec: 90,
    });
    expect(result.validationErrors).toBeUndefined();
  });
  it("answers UNAVAILABLE when a fail-closed policy cannot be checked", async () => {
    hit.mockResolvedValue({ allowed: false, retryAfterSec: 30, unavailable: true });
    expect((await echo({ n: 1 })).serverError).toMatchObject({ code: "UNAVAILABLE" });
  });
  it("keeps the code of a deliberate AppError but hides the details of a bug", async () => {
    hit.mockResolvedValue({ allowed: true, retryAfterSec: 0, unavailable: false });
    expect((await boom({ kind: "app" })).serverError).toEqual({
      code: "CONFLICT",
      message: "Already exists",
    });
    const bug = await boom({ kind: "bug" });
    expect(bug.serverError).toEqual({ code: "INTERNAL", message: "Something went wrong" });
    expect(JSON.stringify(bug)).not.toContain("hunter2");
  });
  it("returns validation errors for bad input once allowed", async () => {
    hit.mockResolvedValue({ allowed: true, retryAfterSec: 0, unavailable: false });
    const result = await echo({ n: "x" } as never);
    expect(result.validationErrors).toBeDefined();
  });
});
