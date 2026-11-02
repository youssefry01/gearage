// The session cookie's attributes, read from the Set-Cookie header Better Auth produces. APP_URL decides Secure: this
// file runs as if deployed over https (production), the e2e suite covers plain http://localhost.
process.env["APP_URL"] = "https://shop.example.test";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetData } from "./helpers";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  after: () => undefined,
}));
vi.mock("@/server/security/rate-limit/limiter", () => ({
  getLimiter: () => ({
    hit: async () => ({ allowed: true, retryAfterSec: 0, unavailable: false }),
  }),
}));
vi.mock("@/server/security/timing", () => ({
  withMinimumDuration: async <T>(_ms: number, fn: () => Promise<T>) => fn(),
}));
vi.mock("@/server/services/password-policy.service", () => ({
  assessPassword: async () => ({ ok: true, breachCheck: "skipped" }),
}));

const auth = await import("@/server/services/auth.service");
const { getAuth } = await import("@/server/auth/auth");
const { registerSchema } = await import("@/domain/auth");

const PASSWORD = "correct-horse-battery-staple-91";
beforeEach(resetData);

describe("session cookie attributes in production (https)", () => {
  it("is __Secure-prefixed, Secure, HttpOnly, SameSite=Lax, Path=/ and lasts 7 days", async () => {
    await auth.register(
      registerSchema.parse({
        firstName: "A",
        lastName: "B",
        email: "c@example.test",
        phone: "01012345678",
        password: PASSWORD,
        acceptTerms: true,
      }),
      "en",
    );
    const row = (await db().emailOutbox.findFirstOrThrow({ where: { template: "verify-code" } }))
      .payload as {
      code: string;
    };
    await auth.verifyEmail("c@example.test", row.code);

    const { headers } = await getAuth().api.signInEmail({
      body: { email: "c@example.test", password: PASSWORD },
      returnHeaders: true,
    });
    const cookies = headers.getSetCookie();
    const session = cookies.find((c) => c.includes("auth.session_token"));
    expect(session, cookies.join("\n")).toBeDefined();
    expect(session).toMatch(/^__Secure-auth\.session_token=/);
    expect(session).toMatch(/;\s*Secure/i);
    expect(session).toMatch(/;\s*HttpOnly/i);
    expect(session).toMatch(/;\s*SameSite=Lax/i);
    expect(session).toMatch(/;\s*Path=\//i);
    expect(session).toMatch(/Max-Age=604800/i);
    expect(session).not.toMatch(/Domain=/i); // host-only: never shared with sibling subdomains
  });
});
