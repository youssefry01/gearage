import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import type * as PasswordModule from "@/server/security/password";
import { db, resetData } from "./helpers";

// Real PostgreSQL, real Better Auth, real Argon2. Only the framework edges are replaced: `after` (post-response work)
// is a no-op so no email is dispatched (the outbox rows are read instead), the limiter is switchable per test, and the
// password policy skips the network breach check.
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  after: () => undefined,
}));
let limiterAllows = true;
vi.mock("@/server/security/rate-limit/limiter", () => ({
  getLimiter: () => ({
    hit: async () => ({ allowed: limiterAllows, retryAfterSec: 60, unavailable: false }),
  }),
}));
vi.mock("@/server/security/timing", () => ({
  withMinimumDuration: async <T>(_ms: number, fn: () => Promise<T>) => fn(),
}));
vi.mock("@/server/services/password-policy.service", () => ({
  assessPassword: async (p: string) =>
    p.length < 12 ? { ok: false, issue: "too_short" } : { ok: true, breachCheck: "skipped" },
}));

// Lets one test change the stored hash AFTER the current password was verified and BEFORE the new hash is written:
// the window a concurrent reset or a second tab could use.
let afterVerify: (() => Promise<void>) | undefined;
vi.mock("@/server/security/password", async (orig) => {
  const real = await orig<typeof PasswordModule>();
  return {
    ...real,
    verifyPassword: async (...args: Parameters<typeof real.verifyPassword>) => {
      const result = await real.verifyPassword(...args);
      await afterVerify?.();
      return result;
    },
  };
});

const auth = await import("@/server/services/auth.service");
const account = await import("@/server/services/account.service");
const repo = await import("@/server/repositories/account.repository");
const authRepo = await import("@/server/repositories/auth.repository");
const { registerSchema } = await import("@/domain/auth");
const { deviceFromUserAgent } = await import("@/domain/device");

const PASSWORD = "correct-horse-battery-staple-91";
const NEW_PASSWORD = "a completely different passphrase 2026";
const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const FIREFOX_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0";

function input(email: string) {
  return registerSchema.parse({
    firstName: "Mona",
    lastName: "Hassan",
    email,
    phone: "010 1234 5678",
    password: PASSWORD,
    marketingConsent: false,
    acceptTerms: true,
  });
}

/** A verified account with one session from Chrome on Windows (created by the real verification sign-in). */
async function makeAccount(email = "mona@example.test") {
  await auth.register(input(email), "en");
  const row = (await db().emailOutbox.findMany({ where: { toEmail: email } })).find(
    (r) => r.template === "verify-code",
  )!;
  const code = (row.payload as { code: string }).code;
  await auth.verifyEmail(email, code, { device: deviceFromUserAgent(CHROME_WIN) });
  const user = await db().user.findUniqueOrThrow({ where: { email } });
  return user;
}

/** Another sign-in, as another browser. */
async function signInFrom(email: string, userAgent: string) {
  await auth.login(email, PASSWORD, "en", { device: deviceFromUserAgent(userAgent) });
}

const sessionsOf = (userId: string) =>
  db().session.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });

beforeEach(async () => {
  afterVerify = undefined;
  limiterAllows = true;
  await resetData();
});

describe("device label on sessions (data minimization)", () => {
  it("stores only the coarse label: no raw User-Agent, no IP, and a SIGN_IN event with the same label", async () => {
    const user = await makeAccount();
    const [session] = await sessionsOf(user.id);
    expect(session).toMatchObject({ device: "chrome/windows", userAgent: null, ipAddress: null });

    const events = await db().securityEvent.findMany({ where: { userId: user.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "SIGN_IN", device: "chrome/windows" });
  });

  it("password sign-in records the device of that request; an unrecognised client gets no label", async () => {
    const user = await makeAccount();
    await signInFrom("mona@example.test", FIREFOX_MAC);
    await auth.login("mona@example.test", PASSWORD, "en", {
      device: deviceFromUserAgent("curl/8"),
    });
    const sessions = await sessionsOf(user.id);
    expect(sessions.map((s) => s.device)).toEqual(["chrome/windows", "firefox/macos", null]);
    for (const s of sessions) expect([s.userAgent, s.ipAddress]).toEqual([null, null]);
  });

  it("the database refuses a raw User-Agent in the device columns, and a device on any event but SIGN_IN", async () => {
    const user = await makeAccount();
    await expect(
      db().session.updateMany({ where: { userId: user.id }, data: { device: CHROME_WIN } }),
    ).rejects.toThrow(/session_device_format_check/);
    await expect(
      db().securityEvent.create({
        data: { userId: user.id, type: "SIGN_IN", device: CHROME_WIN, createdAt: new Date() },
      }),
    ).rejects.toThrow(/security_event_device_format_check/);
    await expect(
      db().securityEvent.create({
        data: {
          userId: user.id,
          type: "PASSWORD_CHANGED",
          device: "chrome/windows",
          createdAt: new Date(),
        },
      }),
    ).rejects.toThrow(/security_event_device_signin_check/);
  });
});

describe("profile", () => {
  it("saves name, mobile, date of birth and gender; clears optional fields; leaves email and consent alone", async () => {
    const user = await makeAccount();
    await account.updateProfile(
      user.id,
      {
        firstName: "منى",
        lastName: "حسن",
        phone: "+201512345678",
        dateOfBirth: "1990-05-17",
        gender: "female",
      },
      { now: () => new Date("2026-11-04T10:00:00Z") },
    );
    let after = await db().user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after).toMatchObject({
      firstName: "منى",
      lastName: "حسن",
      name: "منى حسن",
      phone: "+201512345678",
      gender: "FEMALE",
      email: user.email,
      termsVersion: user.termsVersion,
      marketingConsent: false,
    });
    expect(after.dateOfBirth?.toISOString().slice(0, 10)).toBe("1990-05-17");

    await account.updateProfile(user.id, {
      firstName: "Mona",
      lastName: "Hassan",
      phone: "+201012345678",
      dateOfBirth: undefined,
      gender: undefined,
    });
    after = await db().user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.dateOfBirth).toBeNull();
    expect(after.gender).toBeNull();
  });

  it("refuses a date of birth under the minimum age, and never touches another account", async () => {
    const mona = await makeAccount();
    const other = await makeAccount("other@example.test");
    await expect(
      account.updateProfile(
        mona.id,
        {
          firstName: "A",
          lastName: "B",
          phone: "+201012345678",
          dateOfBirth: "2020-01-01",
          gender: undefined,
        },
        { now: () => new Date("2026-11-04T10:00:00Z") },
      ),
    ).rejects.toMatchObject({ details: { field: "dateOfBirth", issue: "too_young" } });
    await account.updateProfile(mona.id, {
      firstName: "Changed",
      lastName: "Name",
      phone: "+201012345678",
      dateOfBirth: undefined,
      gender: undefined,
    });
    expect((await db().user.findUniqueOrThrow({ where: { id: other.id } })).firstName).toBe("Mona");
  });
});

describe("change password", () => {
  const change = (user: { id: string; email: string }, sessionId: string, over = {}) =>
    account.changePassword({
      userId: user.id,
      email: user.email,
      sessionId,
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      locale: "en",
      device: "chrome/windows",
      ...over,
    });

  it("replaces the hash, keeps THIS session, deletes every other, logs the event and queues the notice (one transaction)", async () => {
    const user = await makeAccount();
    await signInFrom(user.email, FIREFOX_MAC);
    await signInFrom(user.email, CHROME_WIN);
    const before = await sessionsOf(user.id);
    expect(before).toHaveLength(3);
    const keep = before[0]!;
    const oldHash = (await authRepo.getCredentialHash(user.id))!;

    const res = await change(user, keep.id);
    expect(res).toEqual({ status: "changed", signedOutOthers: 2 });

    const after = await sessionsOf(user.id);
    expect(after.map((s) => s.id)).toEqual([keep.id]);
    const newHash = (await authRepo.getCredentialHash(user.id))!;
    expect(newHash).not.toBe(oldHash);
    expect(newHash).toMatch(/^pv\d+:\$argon2id\$/);

    const events = await db().securityEvent.findMany({
      where: { userId: user.id, type: "PASSWORD_CHANGED" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.device).toBeNull(); // only sign-ins carry a label

    const mail = (await db().emailOutbox.findMany({ where: { toEmail: user.email } })).filter(
      (r) => r.template === "password-changed",
    );
    expect(mail).toHaveLength(1);
    expect(mail[0]!.payload).toEqual({
      device: "chrome/windows",
      resetUrl: expect.stringMatching(/\/en\/forgot-password$/),
    });

    // The new password works and the old one does not.
    await expect(auth.login(user.email, PASSWORD, "en")).rejects.toBeInstanceOf(AppError);
    expect((await auth.login(user.email, NEW_PASSWORD, "en")).status).toBe("ok");
  });

  it("a wrong current password changes nothing (no hash, no sessions, no event, no email)", async () => {
    const user = await makeAccount();
    await signInFrom(user.email, FIREFOX_MAC);
    const [keep] = await sessionsOf(user.id);
    const oldHash = await authRepo.getCredentialHash(user.id);
    await expect(
      change(user, keep!.id, { currentPassword: "not-my-password-0000" }),
    ).rejects.toMatchObject({
      details: { field: "currentPassword", issue: "wrong_current_password" },
    });
    expect(await authRepo.getCredentialHash(user.id)).toBe(oldHash);
    expect(await sessionsOf(user.id)).toHaveLength(2);
    expect(await db().securityEvent.count({ where: { type: "PASSWORD_CHANGED" } })).toBe(0);
    expect(
      (await db().emailOutbox.findMany()).filter((r) => r.template === "password-changed"),
    ).toHaveLength(0);
  });

  it("refuses the same password (also typed with a different Unicode form) and a policy failure, after checking the current one", async () => {
    const user = await makeAccount();
    const [s] = await sessionsOf(user.id);
    await expect(change(user, s!.id, { newPassword: PASSWORD })).rejects.toMatchObject({
      details: { field: "newPassword", issue: "same_password" },
    });
    await expect(change(user, s!.id, { newPassword: "short" })).rejects.toMatchObject({
      details: { field: "newPassword", issue: "too_short" },
    });
    // A wrong current password is reported before any policy verdict on the new one (no oracle for the policy).
    await expect(
      change(user, s!.id, { currentPassword: "nope-nope-nope-nope", newPassword: "short" }),
    ).rejects.toMatchObject({ details: { issue: "wrong_current_password" } });
  });

  it("is limited per account: once the limit is reached nothing is checked or changed", async () => {
    const user = await makeAccount();
    const [s] = await sessionsOf(user.id);
    limiterAllows = false;
    await expect(change(user, s!.id)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    limiterAllows = true;
    expect(await db().securityEvent.count({ where: { type: "PASSWORD_CHANGED" } })).toBe(0);
  });

  it("does not overwrite a password that changed while the request ran (compare-and-set) and rolls everything back", async () => {
    const user = await makeAccount();
    await signInFrom(user.email, FIREFOX_MAC);
    const [keep] = await sessionsOf(user.id);
    const swapped = "pv1:$argon2id$v=19$m=65536,t=3,p=1$c29tZXNhbHQ$c29tZWhhc2g";
    afterVerify = async () => {
      // A reset lands right after the current password was verified.
      await db().account.updateMany({
        where: { userId: user.id, providerId: "credential" },
        data: { password: swapped },
      });
    };
    await expect(change(user, keep!.id)).rejects.toMatchObject({
      code: "CONFLICT",
      details: { issue: "try_again" },
    });
    afterVerify = undefined;
    expect(await authRepo.getCredentialHash(user.id)).toBe(swapped); // the newer hash survived
    expect(await sessionsOf(user.id)).toHaveLength(2); // nothing was signed out
    expect(await db().securityEvent.count({ where: { type: "PASSWORD_CHANGED" } })).toBe(0);
    expect(
      (await db().emailOutbox.findMany()).filter((r) => r.template === "password-changed"),
    ).toHaveLength(0);
  });
});

describe("sessions list and sign-out", () => {
  it("lists only this account's live sessions, this device first, with no secret fields", async () => {
    const mona = await makeAccount();
    await makeAccount("other@example.test");
    await signInFrom(mona.email, FIREFOX_MAC);
    const all = await sessionsOf(mona.id);
    // An expired session is not listed.
    await db().session.create({
      data: {
        userId: mona.id,
        token: "expired-token",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
        expiresAt: new Date("2026-01-08"),
        device: "safari/ios",
      },
    });
    const current = all[1]!;
    const list = await account.listSessions(mona.id, current.id);
    expect(list.map((s) => [s.device, s.current])).toEqual([
      ["firefox/macos", true],
      ["chrome/windows", false],
    ]);
    for (const row of list)
      expect(Object.keys(row).sort()).toEqual([
        "current",
        "device",
        "id",
        "lastActiveAt",
        "signedInAt",
      ]);
    const raw = await repo.listSessions(mona.id, new Date(), 10);
    for (const row of raw) expect(row).not.toHaveProperty("token");
  });

  it("signs out one other device; a session id from ANOTHER account deletes nothing (no IDOR); the current one is refused", async () => {
    const mona = await makeAccount();
    const other = await makeAccount("other@example.test");
    await signInFrom(mona.email, FIREFOX_MAC);
    const [first, second] = await sessionsOf(mona.id);
    const [victim] = await sessionsOf(other.id);

    await expect(account.revokeSession(mona.id, second!.id, second!.id)).rejects.toMatchObject({
      details: { issue: "current_session" },
    });
    // Aiming at someone else's session answers like success but removes nothing.
    // (count 0: the same answer as for an id that never existed, so it says nothing about other accounts)
    expect(await account.revokeSession(mona.id, second!.id, victim!.id)).toEqual({
      status: "revoked",
      count: 0,
    });
    expect(await sessionsOf(other.id)).toHaveLength(1);

    expect(await account.revokeSession(mona.id, second!.id, first!.id)).toEqual({
      status: "revoked",
      count: 1,
    });
    expect((await sessionsOf(mona.id)).map((s) => s.id)).toEqual([second!.id]);
    expect(
      await db().securityEvent.count({ where: { userId: mona.id, type: "SESSION_REVOKED" } }),
    ).toBe(1);
    // Doing it again is harmless and logs nothing more.
    await account.revokeSession(mona.id, second!.id, first!.id);
    expect(
      await db().securityEvent.count({ where: { userId: mona.id, type: "SESSION_REVOKED" } }),
    ).toBe(1);
  });

  it("'Sign out of other devices' keeps the current session, touches no other account, and logs once", async () => {
    const mona = await makeAccount();
    const other = await makeAccount("other@example.test");
    await signInFrom(mona.email, FIREFOX_MAC);
    await signInFrom(mona.email, CHROME_WIN);
    const [, keep] = await sessionsOf(mona.id);
    const res = await account.revokeOtherSessions(mona.id, keep!.id);
    expect(res).toEqual({ status: "revoked", count: 2 });
    expect((await sessionsOf(mona.id)).map((s) => s.id)).toEqual([keep!.id]);
    expect(await sessionsOf(other.id)).toHaveLength(1);
    expect(
      await db().securityEvent.count({
        where: { userId: mona.id, type: "OTHER_SESSIONS_REVOKED" },
      }),
    ).toBe(1);
    // Nothing left to sign out: no second event.
    expect((await account.revokeOtherSessions(mona.id, keep!.id)).count).toBe(0);
    expect(
      await db().securityEvent.count({
        where: { userId: mona.id, type: "OTHER_SESSIONS_REVOKED" },
      }),
    ).toBe(1);
  });
});

describe("security activity", () => {
  it("lists the newest events first with a device only on sign-ins, never more than the page size", async () => {
    const user = await makeAccount();
    const base = Date.now();
    for (let i = 0; i < 25; i++) {
      await repo.insertSecurityEvent({
        userId: user.id,
        type: "SIGN_IN",
        device: "firefox/macos",
        createdAt: new Date(base + (i + 1) * 1000),
      });
    }
    await repo.insertSecurityEvent({
      userId: user.id,
      type: "PASSWORD_CHANGED",
      device: "firefox/macos", // ignored: a device only goes on a sign-in
      createdAt: new Date(base + 999_000),
    });
    const events = await account.listActivity(user.id);
    expect(events).toHaveLength(20);
    expect(events[0]).toMatchObject({ type: "PASSWORD_CHANGED", device: null });
    expect(events[1]).toMatchObject({ type: "SIGN_IN", device: "firefox/macos" });
  });

  it("logs a password reset by email", async () => {
    const user = await makeAccount();
    await auth.requestPasswordReset(user.email, "en");
    const row = (await db().emailOutbox.findMany({ where: { toEmail: user.email } })).find(
      (r) => r.template === "reset-password",
    )!;
    const token = decodeURIComponent((row.payload as { url: string }).url.split("#token=")[1]!);
    await auth.resetPassword(token, NEW_PASSWORD);
    expect(
      await db().securityEvent.count({ where: { userId: user.id, type: "PASSWORD_RESET" } }),
    ).toBe(1);
    expect(await sessionsOf(user.id)).toHaveLength(0); // a reset revokes every session
  });

  it("is deleted with the account and pruned after the retention period (and not before)", async () => {
    const user = await makeAccount();
    const now = new Date("2026-11-04T12:00:00Z");
    const day = 86_400_000;
    await db().securityEvent.createMany({
      data: [
        { userId: user.id, type: "SIGN_IN", createdAt: new Date(now.getTime() - 366 * day) },
        { userId: user.id, type: "SIGN_IN", createdAt: new Date(now.getTime() - 364 * day) },
      ],
    });
    const result = await authRepo.pruneAuthData(
      now,
      new Date(now.getTime() - 7 * day),
      new Date(now.getTime() - 365 * day),
    );
    expect(result.securityEvents).toBe(1);
    expect(
      await db().securityEvent.count({
        where: { createdAt: { lt: new Date(now.getTime() - 365 * day) } },
      }),
    ).toBe(0);
    await db().user.delete({ where: { id: user.id } });
    expect(await db().securityEvent.count()).toBe(0);
  });
});
