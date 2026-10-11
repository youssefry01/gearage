import { describe, expect, it } from "vitest";
import { getEnv } from "@/lib/env";

const valid = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  CRON_SECRET: "x".repeat(32),
} as unknown as NodeJS.ProcessEnv;

describe("getEnv", () => {
  it("accepts a valid environment and applies defaults", () => {
    const env = getEnv(valid);
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("lists every invalid variable in one error", () => {
    const bad = { NODE_ENV: "test", CRON_SECRET: "short" } as unknown as NodeJS.ProcessEnv;
    expect(() => getEnv(bad)).toThrowError(/DATABASE_URL[\s\S]*CRON_SECRET/);
  });

  it("rejects a CRON_SECRET shorter than 32 chars", () => {
    expect(() => getEnv({ ...valid, CRON_SECRET: "a".repeat(31) })).toThrowError(/CRON_SECRET/);
  });
});
