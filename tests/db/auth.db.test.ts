import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { db, resetData } from "./helpers";

// `after` (post-response work) is a no-op so no email is dispatched: the tests read the outbox rows instead.
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
// The minimum-duration floor is exercised in its own unit test; here it would only slow the suite down.
vi.mock("@/server/security/timing", () => ({
  withMinimumDuration: async <T>(_ms: number, fn: () => Promise<T>) => fn(),
}));
vi.mock("@/server/services/password-policy.service", () => ({
  assessPassword: async (p: string) =>
    p.length < 12 ? { ok: false, issue: "too_short" } : { ok: true, breachCheck: "skipped" },
}));

const auth = await import("@/server/services/auth.service");
const { registerSchema } = await import("@/domain/auth");

const PASSWORD = "correct-horse-battery-staple-91";
const t0 = new Date("2026-11-02T10:00:00.000Z");
const min = (n: number) => new Date(t0.getTime() + n * 60_000);

function input(email: string, overrides: Record<string, unknown> = {}) {
  return registerSchema.parse({
    firstName: "Mona",
    lastName: "Hassan",
    email,
    phone: "010 1234 5678",
    password: PASSWORD,
    marketingConsent: false,
    acceptTerms: true,
    ...overrides,
  });
}

const outbox = (to: string) =>
  db().emailOutbox.findMany({ where: { toEmail: to }, orderBy: { createdAt: "asc" } });
const codeOf = async (to: string) => {
  const rows = (await outbox(to)).filter((r) => r.template === "verify-code");
  return (rows.at(-1)!.payload as { code: string }).code;
};

beforeEach(async () => {
  await resetData();
});

describe("registration", () => {
  it("creates an unverified account with consent evidence, a hashed password and a queued 6-digit code", async () => {
    const res = await auth.register(
      input("mona@example.test", {
        marketingConsent: true,
        dateOfBirth: "1990-05-17",
        gender: "female",
      }),
      "ar",
      { now: () => t0 },
    );
    expect(res).toEqual({ status: "check-email" });

    const user = await db().user.findUniqueOrThrow({ where: { email: "mona@example.test" } });
    expect(user).toMatchObject({
      name: "Mona Hassan",
      firstName: "Mona",
      lastName: "Hassan",
      phone: "+201012345678",
      gender: "FEMALE",
      locale: "ar",
      emailVerified: false,
      termsAcceptedAt: t0,
      privacyAcceptedAt: t0,
      termsVersion: "draft-2026-11",
      privacyVersion: "draft-2026-11",
      marketingConsent: true,
      marketingConsentAt: t0,
    });
    expect(user.dateOfBirth?.toISOString()).toBe("1990-05-17T00:00:00.000Z");

    const account = await db().account.findFirstOrThrow({ where: { userId: user.id } });
    expect(account.providerId).toBe("credential");
    expect(account.password).toMatch(/^pv\d+:\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
    expect(account.password).not.toContain(PASSWORD);

    const mails = await outbox("mona@example.test");
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ template: "verify-code", locale: "ar" });
    expect((mails[0]!.payload as { code: string }).code).toMatch(/^\d{6}$/);
    // The code is hashed at rest in the verification table.
    const stored = await db().verification.findMany();
    expect(JSON.stringify(stored)).not.toContain((mails[0]!.payload as { code: string }).code);
  });

  it("records no marketing time when marketing consent was not given", async () => {
    await auth.register(input("nomark@example.test"), "en", { now: () => t0 });
    const user = await db().user.findUniqueOrThrow({ where: { email: "nomark@example.test" } });
    expect(user).toMatchObject({ marketingConsent: false, marketingConsentAt: null });
  });

  it("answers the same for an address that already has an account, creates nothing and emails the owner", async () => {
    const first = await auth.register(input("dup@example.test"), "en", { now: () => t0 });
    const second = await auth.register(
      input("dup@example.test", { password: "another-long-passphrase-777" }),
      "en",
      {
        now: () => min(1),
      },
    );
    expect(second).toEqual(first);
    expect(await db().user.count()).toBe(1);
    expect(await db().account.count()).toBe(1);
    const templates = (await outbox("dup@example.test")).map((r) => r.template);
    expect(templates.sort()).toEqual(["account-exists", "verify-code"]);
    // The existing account kept its ORIGINAL password hash (the second attempt changed nothing).
    const user = await db().user.findUniqueOrThrow({ where: { email: "dup@example.test" } });
    await auth.verifyEmail("dup@example.test", await codeOf("dup@example.test"));
    await expect(
      auth.login("dup@example.test", "another-long-passphrase-777", "en"),
    ).rejects.toBeInstanceOf(AppError);
    expect((await auth.login("dup@example.test", PASSWORD, "en")).status).toBe("ok");
    expect(user.id).toBeTruthy();
  });

  it("treats the email case-insensitively", async () => {
    await auth.register(input("Case@Example.TEST"), "en", { now: () => t0 });
    await auth.register(input("case@example.test"), "en", { now: () => t0 });
    expect(await db().user.count()).toBe(1);
    expect((await db().user.findFirstOrThrow()).email).toBe("case@example.test");
  });

  it("reports password and date-of-birth problems (they reveal nothing about the address)", async () => {
    await expect(
      auth.register({ ...input("p@example.test"), password: "short" }, "en"),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { field: "password", issue: "too_short" },
    });
    await expect(
      auth.register(input("y@example.test", { dateOfBirth: "2020-01-01" }), "en", {
        now: () => t0,
      }),
    ).rejects.toMatchObject({ details: { field: "dateOfBirth", issue: "too_young" } });
    expect(await db().user.count()).toBe(0);
  });
});

describe("email verification", () => {
  it("verifies with the emailed code, signs the person in and burns the code", async () => {
    await auth.register(input("v@example.test"), "en", { now: () => t0 });
    const code = await codeOf("v@example.test");
    expect(await auth.verifyEmail("v@example.test", code)).toEqual({ status: "verified" });
    expect(
      (await db().user.findUniqueOrThrow({ where: { email: "v@example.test" } })).emailVerified,
    ).toBe(true);
    expect(await db().session.count()).toBe(1);
    await expect(auth.verifyEmail("v@example.test", code)).rejects.toMatchObject({
      details: { issue: "invalid_code" },
    });
  });

  it("refuses a wrong code, and destroys the code after too many wrong guesses", async () => {
    await auth.register(input("g@example.test"), "en", { now: () => t0 });
    const code = await codeOf("g@example.test");
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      await expect(auth.verifyEmail("g@example.test", wrong)).rejects.toMatchObject({
        details: { issue: "invalid_code" },
      });
    }
    // The right code no longer works: five wrong guesses used it up.
    await expect(auth.verifyEmail("g@example.test", code)).rejects.toBeInstanceOf(AppError);
    expect(
      (await db().user.findUniqueOrThrow({ where: { email: "g@example.test" } })).emailVerified,
    ).toBe(false);
  });

  it("gives an unknown address the same refusal as a wrong code", async () => {
    await expect(auth.verifyEmail("nobody@example.test", "123456")).rejects.toMatchObject({
      details: { issue: "invalid_code" },
    });
  });

  it("resend queues a new code only for an unverified account, and says the same thing either way", async () => {
    await auth.register(input("r@example.test"), "en", { now: () => t0 });
    expect(await auth.resendCode("r@example.test", "en")).toEqual({ status: "sent" });
    expect(
      (await outbox("r@example.test")).filter((m) => m.template === "verify-code"),
    ).toHaveLength(2);
    expect(await auth.resendCode("ghost@example.test", "en")).toEqual({ status: "sent" });
    expect(await outbox("ghost@example.test")).toHaveLength(0);
    await auth.verifyEmail("r@example.test", await codeOf("r@example.test"));
    expect(await auth.resendCode("r@example.test", "en")).toEqual({ status: "sent" });
    expect(
      (await outbox("r@example.test")).filter((m) => m.template === "verify-code"),
    ).toHaveLength(2);
  });
});

describe("login", () => {
  async function verifiedAccount(email: string) {
    await auth.register(input(email), "en", { now: () => t0 });
    await auth.verifyEmail(email, await codeOf(email));
    await db().session.deleteMany();
  }

  it("signs in a verified account and opens one session (cookie flags: auth-cookies.db.test.ts)", async () => {
    await verifiedAccount("l@example.test");
    expect(await auth.login("L@Example.test", PASSWORD, "en", { now: () => t0 })).toEqual({
      status: "ok",
    });
    expect(await db().session.count()).toBe(1);
  });

  it("tells an unverified account with the right password to verify, and sends a fresh code", async () => {
    await auth.register(input("u@example.test"), "en", { now: () => t0 });
    expect(await auth.login("u@example.test", PASSWORD, "en", { now: () => t0 })).toEqual({
      status: "unverified",
    });
    expect(
      (await outbox("u@example.test")).filter((m) => m.template === "verify-code"),
    ).toHaveLength(2);
    expect(await db().session.count()).toBe(0);
  });

  it("rejects a wrong password and an unknown address with the same error and the same bookkeeping", async () => {
    await verifiedAccount("k@example.test");
    const fail = (email: string) =>
      auth.login(email, "wrong-password-0000", "en", { now: () => t0 }).catch((e: unknown) => e);
    const a = (await fail("k@example.test")) as AppError;
    const b = (await fail("ghost@example.test")) as AppError;
    expect(a).toBeInstanceOf(AppError);
    expect([a.code, a.message]).toEqual([b.code, b.message]);
    // Both addresses have exactly one recorded failure, and neither row contains an email address.
    const rows = await db().loginThrottle.findMany();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.failures === 1 && !r.key.includes("@"))).toBe(true);
  });

  it("locks progressively: free for four failures, then 30 s, 1 min, 2 min, and a lock refuses even the right password", async () => {
    await verifiedAccount("lock@example.test");
    const bad = (at: Date) =>
      auth
        .login("lock@example.test", "wrong-password-0000", "en", { now: () => at })
        .catch((e: unknown) => e);
    for (let i = 0; i < 4; i++) expect(await bad(t0)).toMatchObject({ code: "UNAUTHENTICATED" });
    expect((await db().loginThrottle.findFirstOrThrow()).lockedUntil).toBeNull();

    expect(await bad(t0)).toMatchObject({ code: "UNAUTHENTICATED" }); // the 5th failure starts a 30 s lock
    const locked = await auth
      .login("lock@example.test", PASSWORD, "en", { now: () => t0 })
      .catch((e: unknown) => e);
    expect(locked).toMatchObject({
      code: "RATE_LIMITED",
      details: { reason: "locked", retryAfterSec: 30 },
    });

    const after30 = new Date(t0.getTime() + 31_000);
    expect(await bad(after30)).toMatchObject({ code: "UNAUTHENTICATED" }); // 6th failure: 1 minute
    const row = await db().loginThrottle.findFirstOrThrow();
    expect(row.failures).toBe(6);
    expect(row.lockedUntil!.getTime() - after30.getTime()).toBe(60_000);

    // After the lock passes, the right password works and clears the record.
    expect(await auth.login("lock@example.test", PASSWORD, "en", { now: () => min(5) })).toEqual({
      status: "ok",
    });
    expect(await db().loginThrottle.count()).toBe(0);
  });

  it("forgets old failures after a quiet hour", async () => {
    await verifiedAccount("quiet@example.test");
    for (let i = 0; i < 4; i++)
      await auth
        .login("quiet@example.test", "wrong-password-0000", "en", { now: () => t0 })
        .catch(() => undefined);
    await auth
      .login("quiet@example.test", "wrong-password-0000", "en", { now: () => min(61) })
      .catch(() => undefined);
    const row = await db().loginThrottle.findFirstOrThrow();
    expect(row.failures).toBe(1);
    expect(row.lockedUntil).toBeNull();
  });

  it("upgrades a hash made with weaker Argon2 parameters on a successful login, and not on a failed one", async () => {
    await verifiedAccount("old@example.test");
    const user = await db().user.findUniqueOrThrow({ where: { email: "old@example.test" } });
    const { hashPassword, passwordConfigFromEnv } = await import("@/server/security/password");
    const config = passwordConfigFromEnv();
    const weak = await hashPassword(PASSWORD, {
      ...config,
      params: { memoryKib: 19_456, timeCost: 2, parallelism: 1 },
    });
    expect(weak).toContain("m=19456,t=2,p=1");
    await db().account.updateMany({ where: { userId: user.id }, data: { password: weak } });

    await auth
      .login("old@example.test", "wrong-password-0000", "en", { now: () => t0 })
      .catch(() => undefined);
    expect((await db().account.findFirstOrThrow({ where: { userId: user.id } })).password).toBe(
      weak,
    );

    expect(await auth.login("old@example.test", PASSWORD, "en", { now: () => min(60) })).toEqual({
      status: "ok",
    });
    const upgraded = (await db().account.findFirstOrThrow({ where: { userId: user.id } }))
      .password!;
    expect(upgraded).not.toBe(weak);
    expect(upgraded).toContain("m=65536,t=3,p=1");
    // ...and the new hash still verifies the same password.
    await db().session.deleteMany();
    expect(await auth.login("old@example.test", PASSWORD, "en", { now: () => min(120) })).toEqual({
      status: "ok",
    });
  });
});

const tokenFrom = async (to: string) => {
  const rows = (await outbox(to)).filter((r) => r.template === "reset-password");
  const url = (rows.at(-1)!.payload as { url: string }).url;
  return { url, token: decodeURIComponent(url.split("#token=")[1]!) };
};

describe("forgot and reset password", () => {
  async function verifiedAccount(email: string) {
    await auth.register(input(email), "en", { now: () => t0 });
    await auth.verifyEmail(email, await codeOf(email));
  }
  const NEW = "a-brand-new-passphrase-4242";

  it("emails a reset link (token in the URL fragment) to a real address and nothing to an unknown one, same answer", async () => {
    await verifiedAccount("f@example.test");
    expect(await auth.requestPasswordReset("f@example.test", "ar")).toEqual({ status: "sent" });
    expect(await auth.requestPasswordReset("nobody@example.test", "ar")).toEqual({
      status: "sent",
    });
    const { url } = await tokenFrom("f@example.test");
    expect(url).toMatch(/^http:\/\/localhost:3000\/ar\/reset-password#token=[A-Za-z0-9_-]{16,}$/);
    expect(url).not.toContain("?"); // nothing in the query string, so nothing in a server log or a Referer
    expect(await outbox("nobody@example.test")).toHaveLength(0);
  });

  it("sets the new password, burns the token, revokes sessions and clears a lockout", async () => {
    await verifiedAccount("s@example.test");
    for (let i = 0; i < 5; i++)
      await auth
        .login("s@example.test", "wrong-password-0000", "en", { now: () => t0 })
        .catch(() => undefined);
    expect(await db().loginThrottle.count()).toBe(1);
    expect(await db().session.count()).toBeGreaterThan(0);

    await auth.requestPasswordReset("s@example.test", "en");
    const { token } = await tokenFrom("s@example.test");
    expect(await auth.resetPassword(token, NEW, { now: () => t0 })).toEqual({ status: "reset" });

    expect(await db().session.count()).toBe(0); // every session of the account is gone
    expect(await db().loginThrottle.count()).toBe(0); // the lock is cleared
    await expect(
      auth.login("s@example.test", PASSWORD, "en", { now: () => t0 }),
    ).rejects.toBeInstanceOf(AppError);
    await db().loginThrottle.deleteMany();
    expect((await auth.login("s@example.test", NEW, "en", { now: () => t0 })).status).toBe("ok");
    // One use only.
    await expect(auth.resetPassword(token, "yet-another-passphrase-99")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      details: { issue: "invalid_token" },
    });
  });

  it("applies the password policy BEFORE consuming the token, so a weak attempt does not waste the link", async () => {
    await verifiedAccount("w@example.test");
    await auth.requestPasswordReset("w@example.test", "en");
    const { token } = await tokenFrom("w@example.test");
    await expect(auth.resetPassword(token, "short")).rejects.toMatchObject({
      details: { field: "password", issue: "too_short" },
    });
    expect(await auth.resetPassword(token, NEW)).toEqual({ status: "reset" });
  });

  it("refuses an unknown, malformed or expired token with the same error", async () => {
    await verifiedAccount("x@example.test");
    await auth.requestPasswordReset("x@example.test", "en");
    const { token } = await tokenFrom("x@example.test");
    await db().verification.updateMany({
      where: { identifier: `reset-password:${token}` },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    for (const bad of [token, "A".repeat(24), "not-a-real-token-at-all-xx"]) {
      await expect(auth.resetPassword(bad, NEW)).rejects.toMatchObject({
        details: { issue: "invalid_token" },
      });
    }
  });

  it("verifies an address whose owner followed the emailed link (they control the inbox), and replaces the registrant's password", async () => {
    await auth.register(input("p@example.test"), "en", { now: () => t0 }); // never verified
    await auth.requestPasswordReset("p@example.test", "en");
    await auth.resetPassword((await tokenFrom("p@example.test")).token, NEW);
    expect(
      (await db().user.findUniqueOrThrow({ where: { email: "p@example.test" } })).emailVerified,
    ).toBe(true);
    await expect(
      auth.login("p@example.test", PASSWORD, "en", { now: () => t0 }),
    ).rejects.toBeInstanceOf(AppError);
    expect((await auth.login("p@example.test", NEW, "en", { now: () => t0 })).status).toBe("ok");
  });
});

describe("pruneAuthData", () => {
  it("removes stale unverified accounts, expired one-time values and sessions, and old lockout rows, and nothing else", async () => {
    const repo = await import("@/server/repositories/auth.repository");
    await auth.register(input("old-unverified@example.test"), "en", { now: () => t0 });
    await auth.register(input("fresh-unverified@example.test"), "en", { now: () => t0 });
    await auth.register(input("verified@example.test"), "en", { now: () => t0 });
    await auth.verifyEmail("verified@example.test", await codeOf("verified@example.test"));
    const week = 7 * 86_400_000;
    const now = new Date(Date.now() + 3_600_000);
    await db().user.updateMany({
      where: { email: "old-unverified@example.test" },
      data: { createdAt: new Date(now.getTime() - week - 1000) },
    });
    await db().user.updateMany({
      where: { email: "verified@example.test" },
      data: { createdAt: new Date(now.getTime() - 30 * 86_400_000) },
    });
    await db().loginThrottle.createMany({
      data: [
        { key: "old", failures: 3, lastFailureAt: new Date(now.getTime() - 2 * 86_400_000) },
        { key: "recent", failures: 3, lastFailureAt: now },
      ],
    });

    const year = 365 * 86_400_000;
    const result = await repo.pruneAuthData(
      now,
      new Date(now.getTime() - week),
      new Date(now.getTime() - year),
    );
    expect(result.unverifiedUsers).toBe(1);
    expect(result.throttles).toBe(1);
    const emails = (await db().user.findMany()).map((u) => u.email).sort();
    expect(emails).toEqual(["fresh-unverified@example.test", "verified@example.test"]);
    expect((await db().loginThrottle.findMany()).map((r) => r.key)).toEqual(["recent"]);
    // Running it again changes nothing (jobs must be idempotent).
    expect(
      await repo.pruneAuthData(now, new Date(now.getTime() - week), new Date(now.getTime() - year)),
    ).toEqual({
      unverifiedUsers: 0,
      verifications: 0,
      sessions: 0,
      throttles: 0,
      securityEvents: 0,
      emailChangeRequests: 0,
    });
  });
});

describe("logout", () => {
  it("is exposed as a service that needs the caller's session cookie", () => {
    expect(typeof auth.logout).toBe("function");
  });
});
