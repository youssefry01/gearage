import { describe, expect, it } from "vitest";
import { AppError, isAppError } from "@/lib/errors";

describe("AppError", () => {
  it("maps codes to HTTP statuses", () => {
    expect(new AppError("NOT_FOUND", "x").status).toBe(404);
    expect(new AppError("RATE_LIMITED", "x").status).toBe(429);
    expect(new AppError("VALIDATION_FAILED", "x").status).toBe(422);
  });

  it("is detectable and keeps the cause", () => {
    const cause = new Error("root");
    const e = new AppError("INTERNAL", "boom", { cause });
    expect(isAppError(e)).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
    expect(e.cause).toBe(cause);
  });
});
