import { describe, expect, it } from "vitest";
import { getEnv, isTestMode, loadPeppers, resolveEmailProvider, upstashConfig } from "@/lib/env";

const valid = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  CRON_SECRET: "x".repeat(32),
  AUTH_SECRET: "a".repeat(32),
  PASSWORD_PEPPER: "p".repeat(32),
} as unknown as NodeJS.ProcessEnv;
const withEnv = (extra: Record<string, string>) => ({ ...valid, ...extra }) as NodeJS.ProcessEnv;

describe("getEnv", () => {
  it("accepts a valid environment and applies defaults", () => {
    const env = getEnv(valid);
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.PASSWORD_PEPPER_CURRENT_VERSION).toBe(1);
    expect(env.TRUST_PROXY_HEADERS).toBe("0");
    expect(env.EMAIL_LOG_DIR).toBe(".emails");
    expect(env.RATE_LIMIT_SCALE).toBe(1);
  });
  it("lists every invalid variable in one error", () => {
    const bad = { NODE_ENV: "test", CRON_SECRET: "short" } as unknown as NodeJS.ProcessEnv;
    expect(() => getEnv(bad)).toThrowError(
      /DATABASE_URL[\s\S]*CRON_SECRET[\s\S]*AUTH_SECRET[\s\S]*PASSWORD_PEPPER/,
    );
  });
  it("rejects a CRON_SECRET, AUTH_SECRET or PASSWORD_PEPPER shorter than 32 chars", () => {
    expect(() => getEnv(withEnv({ CRON_SECRET: "a".repeat(31) }))).toThrowError(/CRON_SECRET/);
    expect(() => getEnv(withEnv({ AUTH_SECRET: "a".repeat(31) }))).toThrowError(/AUTH_SECRET/);
    expect(() => getEnv(withEnv({ PASSWORD_PEPPER: "a".repeat(31) }))).toThrowError(
      /PASSWORD_PEPPER/,
    );
  });
  it("treats blank values as unset (a bare `EMAIL_REPLY_TO=` in .env is fine)", () => {
    const env = getEnv(
      withEnv({
        EMAIL_PROVIDER: "",
        BREVO_API_KEY: "",
        EMAIL_FROM: "",
        EMAIL_REPLY_TO: "",
        UPSTASH_REDIS_REST_URL: "",
        UPSTASH_REDIS_REST_TOKEN: "",
        TRUST_PROXY_HEADERS: "",
      }),
    );
    expect(env.EMAIL_PROVIDER).toBeUndefined();
    expect(env.EMAIL_REPLY_TO).toBeUndefined();
    expect(env.TRUST_PROXY_HEADERS).toBe("0");
  });
});

describe("email provider", () => {
  it("defaults to log without a key and to brevo with one", () => {
    expect(resolveEmailProvider(getEnv(valid))).toBe("log");
    expect(
      resolveEmailProvider(
        getEnv(withEnv({ BREVO_API_KEY: "k".repeat(20), EMAIL_FROM: "me@example.com" })),
      ),
    ).toBe("brevo");
  });
  it("brevo needs the key and the sender address", () => {
    expect(() =>
      getEnv(withEnv({ EMAIL_PROVIDER: "brevo", EMAIL_FROM: "me@example.com" })),
    ).toThrowError(/BREVO_API_KEY/);
    expect(() =>
      getEnv(withEnv({ EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "k".repeat(20) })),
    ).toThrowError(/EMAIL_FROM/);
  });
  it("EMAIL_FROM and EMAIL_REPLY_TO must be email addresses", () => {
    expect(() => getEnv(withEnv({ EMAIL_FROM: "not an address" }))).toThrowError(/EMAIL_FROM/);
    expect(() => getEnv(withEnv({ EMAIL_REPLY_TO: "nope" }))).toThrowError(/EMAIL_REPLY_TO/);
  });
  it("test mode forces log whatever else is set", () => {
    for (const extra of [{ NODE_ENV: "test" }, { TEST_MODE: "1" }] as Record<string, string>[]) {
      const env = getEnv(
        withEnv({
          ...extra,
          EMAIL_PROVIDER: "brevo",
          BREVO_API_KEY: "k".repeat(20),
          EMAIL_FROM: "me@example.com",
        }),
      );
      expect(isTestMode(env)).toBe(true);
      expect(resolveEmailProvider(env)).toBe("log");
    }
  });
  it("log is refused in production, and test-only switches are refused too", () => {
    expect(() => getEnv(withEnv({ VERCEL_ENV: "production" }))).toThrowError(
      /not allowed in production/,
    );
    const live = {
      VERCEL_ENV: "production",
      BREVO_API_KEY: "k".repeat(20),
      EMAIL_FROM: "me@example.com",
    };
    expect(() => getEnv(withEnv(live))).not.toThrow();
    expect(() => getEnv(withEnv({ ...live, TEST_MODE: "1" }))).toThrowError(/TEST_MODE/);
    expect(() => getEnv(withEnv({ ...live, RATE_LIMIT_SCALE: "10" }))).toThrowError(
      /RATE_LIMIT_SCALE/,
    );
  });
});

describe("upstash", () => {
  const url = "https://eu1-example-12345.upstash.io";
  it("needs both values or neither", () => {
    expect(() => getEnv(withEnv({ UPSTASH_REDIS_REST_URL: url }))).toThrowError(/set together/);
    expect(() => getEnv(withEnv({ UPSTASH_REDIS_REST_TOKEN: "t".repeat(20) }))).toThrowError(
      /set together/,
    );
  });
  it("is configured with both, and never in test mode", () => {
    const both = { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: "t".repeat(20) };
    expect(upstashConfig(getEnv(withEnv(both)))).toEqual({ url, token: "t".repeat(20) });
    expect(upstashConfig(getEnv(withEnv({ ...both, TEST_MODE: "1" })))).toBeNull();
    expect(upstashConfig(getEnv(valid))).toBeNull();
  });
});

describe("pepper versions", () => {
  it("version 1 is PASSWORD_PEPPER; V2, V3... come from PASSWORD_PEPPER_V<n>", () => {
    const peppers = loadPeppers(
      withEnv({
        PASSWORD_PEPPER_V2: "q".repeat(32),
        PASSWORD_PEPPER_V10: "r".repeat(32),
        PASSWORD_PEPPERX: "no",
      }),
    );
    expect([...peppers.keys()].sort((a, b) => a - b)).toEqual([1, 2, 10]);
  });
  it("the current version must have a pepper, and every pepper must be 32+ chars", () => {
    expect(() => getEnv(withEnv({ PASSWORD_PEPPER_CURRENT_VERSION: "2" }))).toThrowError(
      /no matching pepper/,
    );
    expect(
      getEnv(withEnv({ PASSWORD_PEPPER_V2: "q".repeat(32), PASSWORD_PEPPER_CURRENT_VERSION: "2" }))
        .PASSWORD_PEPPER_CURRENT_VERSION,
    ).toBe(2);
    expect(() => getEnv(withEnv({ PASSWORD_PEPPER_V2: "short" }))).toThrowError(
      /PASSWORD_PEPPER_V2/,
    );
  });
});
