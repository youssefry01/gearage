// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnv, resolveEmailProvider } from "@/lib/env";
import { getEmailProvider, setEmailProviderForTests } from "./provider";

afterEach(() => {
  setEmailProviderForTests(undefined);
  vi.unstubAllEnvs();
});

describe("a test run can never send real email", () => {
  it("resolves to log in test mode even when .env asks for Brevo and has a key", () => {
    const env = getEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://x",
      CRON_SECRET: "c".repeat(32),
      AUTH_SECRET: "a".repeat(32),
      PASSWORD_PEPPER: "p".repeat(32),
      EMAIL_PROVIDER: "brevo",
      BREVO_API_KEY: "xkeysib-real-looking-key",
      EMAIL_FROM: "me@gmail.com",
    } as NodeJS.ProcessEnv);
    expect(resolveEmailProvider(env)).toBe("log");
    const e2e = getEnv({
      NODE_ENV: "production",
      TEST_MODE: "1",
      DATABASE_URL: "postgresql://x",
      CRON_SECRET: "c".repeat(32),
      AUTH_SECRET: "a".repeat(32),
      PASSWORD_PEPPER: "p".repeat(32),
      EMAIL_PROVIDER: "brevo",
      BREVO_API_KEY: "xkeysib-real-looking-key",
      EMAIL_FROM: "me@gmail.com",
    } as NodeJS.ProcessEnv);
    expect(resolveEmailProvider(e2e)).toBe("log");
  });
  it("the provider this test process gets is the log provider and never calls fetch", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-real-looking-key");
    vi.stubEnv("EMAIL_PROVIDER", "brevo");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const provider = getEmailProvider();
    expect(provider.name).toBe("log");
    await provider.send({ to: "a@example.com", subject: "s", html: "h", text: "t" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
