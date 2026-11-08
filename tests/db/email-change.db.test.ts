import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetData } from "./helpers";

// Real PostgreSQL, real Better Auth, real Argon2 (same edges replaced as in account.db.test.ts).
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  after: () => undefined,
}));
let limiterAllows = true;
const hits: string[] = [];
vi.mock("@/server/security/rate-limit/limiter", () => ({
  getLimiter: () => ({
    hit: async (policy: { name: string }) => {
      hits.push(policy.name);
      return { allowed: limiterAllows, retryAfterSec: 60, unavailable: false };
    },
  }),
}));
vi.mock("@/server/security/timing", () => ({
  withMinimumDuration: async <T>(_ms: number, fn: () => Promise<T>) => fn(),
}));
vi.mock("@/server/services/password-policy.service", () => ({
  assessPassword: async (p: string) =>
    p.length < 12 ? { ok: false, issue: "too_short" } : { ok: true, breachCheck: "skipped" },
}));

const auth = await import("@/server/services/auth.service");
const emailChange = await import("@/server/services/email-change.service");
const authRepo = await import("@/server/repositories/auth.repository");
const { registerSchema } = await import("@/domain/auth");
const { deviceFromUserAgent } = await import("@/domain/device");
const { EMAIL_CHANGE_MAX_ATTEMPTS } = await import("@/domain/email-change");

const PASSWORD = "correct-horse-battery-staple-91";
const NEW_PASSWORD = "a completely different passphrase 2026";
const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const FIREFOX_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0";

async function makeAccount(email: string) {
  await auth.register(
    registerSchema.parse({
      firstName: "Mona",
      lastName: "Hassan",
      email,
      phone: "010 1234 5678",
      password: PASSWORD,
      marketingConsent: false,
      acceptTerms: true,
    }),
    "en",
  );
  const row = (await db().emailOutbox.findMany({ where: { toEmail: email } })).find(
    (r) => r.template === "verify-code",
  )!;
  await auth.verifyEmail(email, (row.payload as { code: string }).code, {
    device: deviceFromUserAgent(CHROME_WIN),
  });
  return db().user.findUniqueOrThrow({ where: { email } });
}

const sessionsOf = (userId: string) => db().session.findMany({ where: { userId } });
const outboxTo = (to: string, template?: string) =>
  db()
    .emailOutbox.findMany({ where: { toEmail: to }, orderBy: { createdAt: "asc" } })
    .then((rows) => rows.filter((r) => !template || r.template === template));

/** Starts a change as the account's first session. */
async function start(
  user: { id: string; email: string },
  newEmail: string,
  overrides: Partial<Parameters<typeof emailChange.requestEmailChange>[0]> = {},
) {
  return emailChange.requestEmailChange({
    userId: user.id,
    currentEmail: user.email,
    newEmail,
    currentPassword: PASSWORD,
    locale: "en",
    device: "chrome/windows",
    ...overrides,
  });
}

async function codeSentTo(to: string): Promise<string> {
  const rows = await outboxTo(to, "email-change-code");
  return (rows.at(-1)!.payload as { code: string }).code;
}

async function confirm(
  user: { id: string; email: string },
  sessionId: string,
  code: string,
  now?: Date,
) {
  return emailChange.confirmEmailChange(
    { userId: user.id, sessionId, currentEmail: user.email, code, locale: "en" },
    now ? { now: () => now } : {},
  );
}

beforeEach(async () => {
  limiterAllows = true;
  hits.length = 0;
  await resetData();
});

describe("starting an email change", () => {
  it("needs the CURRENT password: a wrong one writes nothing and sends nothing", async () => {
    const user = await makeAccount("mona@example.test");
    await expect(
      start(user, "new@example.test", { currentPassword: "not the password at all" }),
    ).rejects.toMatchObject({
      details: { field: "currentPassword", issue: "wrong_current_password" },
    });
    expect(await db().emailChangeRequest.count()).toBe(0);
    expect(await outboxTo("new@example.test")).toHaveLength(0);
    expect(await outboxTo(user.email, "email-change-notice")).toHaveLength(0);
    // Every attempt is counted, right or wrong.
    expect(hits).toContain("auth.email.change.user");
  });

  it("refuses the address the account already has, in any letter case", async () => {
    const user = await makeAccount("mona@example.test");
    await expect(start(user, "mona@example.test")).rejects.toMatchObject({
      details: { field: "newEmail", issue: "same_email" },
    });
  });

  it("a free address: a request row holding only hashes, a code to the NEW address, a notice with a cancel link to the OLD one", async () => {
    const user = await makeAccount("mona@example.test");
    expect(await start(user, "new@example.test")).toEqual({ status: "code-sent" });

    const row = await db().emailChangeRequest.findUniqueOrThrow({ where: { userId: user.id } });
    const code = await codeSentTo("new@example.test");
    expect(code).toMatch(/^\d{6}$/);
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.cancelHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(code);
    expect(row.newEmail).toBe("new@example.test");
    expect(row.attempts).toBe(0);

    const [notice] = await outboxTo(user.email, "email-change-notice");
    const p = notice!.payload as { newEmailMasked: string; cancelUrl: string; device: string };
    expect(p.newEmailMasked).toBe("n***@example.test");
    expect(p.device).toBe("chrome/windows");
    const token = decodeURIComponent(p.cancelUrl.split("#token=")[1]!);
    expect(p.cancelUrl).toMatch(/^http:\/\/localhost:3000\/en\/email-change\/cancel#token=/);
    expect(JSON.stringify(row)).not.toContain(token); // only its hash is stored
    expect(row.cancelHash).toBe(emailChange.hashCancelToken(token));

    expect(
      await db().securityEvent.count({
        where: { userId: user.id, type: "EMAIL_CHANGE_REQUESTED" },
      }),
    ).toBe(1);
  });

  it("a TAKEN address looks the same from outside: same answer, same row, same notice to the old address; its owner gets the 'taken' email instead of a code", async () => {
    const user = await makeAccount("mona@example.test");
    await makeAccount("taken@example.test");

    const free = await start(user, "free@example.test");
    const rowFree = await db().emailChangeRequest.findUniqueOrThrow({ where: { userId: user.id } });
    const noticesFree = await outboxTo(user.email, "email-change-notice");

    const taken = await start(user, "taken@example.test");
    const rowTaken = await db().emailChangeRequest.findUniqueOrThrow({
      where: { userId: user.id },
    });
    const noticesTaken = await outboxTo(user.email, "email-change-notice");

    expect(taken).toEqual(free);
    expect(Object.keys(rowTaken).sort()).toEqual(Object.keys(rowFree).sort());
    expect(rowTaken.attempts).toBe(0);
    // One more notice to the old address, shaped exactly like the first.
    expect(noticesTaken).toHaveLength(noticesFree.length + 1);
    expect(Object.keys(noticesTaken.at(-1)!.payload as object).sort()).toEqual(
      Object.keys(noticesFree[0]!.payload as object).sort(),
    );
    // The taken address's owner is told; no code is mailed to it.
    expect(await outboxTo("taken@example.test", "email-change-taken")).toHaveLength(1);
    expect(await outboxTo("taken@example.test", "email-change-code")).toHaveLength(0);
    // And a code typed for it can never work, whatever it is.
    await expect(confirm(user, (await sessionsOf(user.id))[0]!.id, "000000")).rejects.toMatchObject(
      { details: { issue: "invalid_code" } },
    );
  });

  it("starting again replaces the pending request (one per account)", async () => {
    const user = await makeAccount("mona@example.test");
    await start(user, "one@example.test");
    const first = await db().emailChangeRequest.findUniqueOrThrow({ where: { userId: user.id } });
    await start(user, "two@example.test");
    const rows = await db().emailChangeRequest.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.newEmail).toBe("two@example.test");
    expect(rows[0]!.id).not.toBe(first.id);
  });

  it("is refused, and writes nothing, when a limit is exceeded", async () => {
    const user = await makeAccount("mona@example.test");
    limiterAllows = false;
    await expect(start(user, "new@example.test")).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(await db().emailChangeRequest.count()).toBe(0);
  });

  it("counts the per-account, per-account-send and per-target limits", async () => {
    const user = await makeAccount("mona@example.test");
    hits.length = 0;
    await start(user, "new@example.test");
    expect(hits).toEqual([
      "auth.email.change.user",
      "auth.email.change.send.user",
      "auth.email.change.send.target",
    ]);
  });
});

describe("confirming an email change", () => {
  it("moves the address, signs out the OTHER devices, kills old reset links, logs it and tells the OLD address", async () => {
    const user = await makeAccount("mona@example.test");
    await auth.login(user.email, PASSWORD, "en", { device: deviceFromUserAgent(FIREFOX_MAC) });
    const [current] = await sessionsOf(user.id);
    await auth.requestPasswordReset(user.email, "en"); // a reset link sitting in the old mailbox
    expect(
      await db().verification.count({ where: { identifier: { startsWith: "reset-password:" } } }),
    ).toBe(1);

    await start(user, "New@Example.test".toLowerCase());
    const code = await codeSentTo("new@example.test");
    const res = await confirm(user, current!.id, code);
    expect(res).toEqual({ status: "changed", signedOutOthers: 1 });

    const after = await db().user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.email).toBe("new@example.test");
    expect(after.emailVerified).toBe(true);
    expect((await sessionsOf(user.id)).map((s) => s.id)).toEqual([current!.id]);
    expect(await db().emailChangeRequest.count()).toBe(0);
    expect(
      await db().verification.count({ where: { identifier: { startsWith: "reset-password:" } } }),
    ).toBe(0);
    expect(
      await db().securityEvent.count({ where: { userId: user.id, type: "EMAIL_CHANGED" } }),
    ).toBe(1);

    const [told] = await outboxTo("mona@example.test", "email-changed");
    expect((told!.payload as { newEmailMasked: string }).newEmailMasked).toBe("n***@example.test");

    // The new address signs in with the same password; the old one no longer exists.
    await expect(auth.login("new@example.test", PASSWORD, "en")).resolves.toEqual({ status: "ok" });
    await expect(auth.login("mona@example.test", PASSWORD, "en")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    // Forgot-password for the old address now reaches nobody.
    const before = await db().emailOutbox.count({ where: { template: "reset-password" } });
    await auth.requestPasswordReset("mona@example.test", "en");
    expect(await db().emailOutbox.count({ where: { template: "reset-password" } })).toBe(before);
  });

  it("wrong codes are counted; at the limit the request is destroyed even for the right code", async () => {
    const user = await makeAccount("mona@example.test");
    const [session] = await sessionsOf(user.id);
    await start(user, "new@example.test");
    const code = await codeSentTo("new@example.test");
    const wrong = code === "123456" ? "654321" : "123456";

    for (let i = 1; i < EMAIL_CHANGE_MAX_ATTEMPTS; i++) {
      await expect(confirm(user, session!.id, wrong)).rejects.toMatchObject({
        details: { issue: "invalid_code" },
      });
      expect(
        (await db().emailChangeRequest.findUniqueOrThrow({ where: { userId: user.id } })).attempts,
      ).toBe(i);
    }
    await expect(confirm(user, session!.id, wrong)).rejects.toMatchObject({
      details: { issue: "too_many_attempts" },
    });
    expect(await db().emailChangeRequest.count()).toBe(0);
    await expect(confirm(user, session!.id, code)).rejects.toMatchObject({
      details: { issue: "no_email_change" },
    });
    expect((await db().user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(user.email);
  });

  it("an expired code is refused and the request removed", async () => {
    const user = await makeAccount("mona@example.test");
    const [session] = await sessionsOf(user.id);
    await start(user, "new@example.test");
    const code = await codeSentTo("new@example.test");
    const later = new Date(Date.now() + 31 * 60_000);
    await expect(confirm(user, session!.id, code, later)).rejects.toMatchObject({
      details: { issue: "expired_code" },
    });
    expect(await db().emailChangeRequest.count()).toBe(0);
  });

  it("two simultaneous submissions of the right code change the address once", async () => {
    const user = await makeAccount("mona@example.test");
    const [session] = await sessionsOf(user.id);
    await start(user, "new@example.test");
    const code = await codeSentTo("new@example.test");
    const results = await Promise.allSettled([
      confirm(user, session!.id, code),
      confirm(user, session!.id, code),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db().securityEvent.count({ where: { type: "EMAIL_CHANGED" } })).toBe(1);
    expect(await outboxTo("mona@example.test", "email-changed")).toHaveLength(1);
  });

  it("if someone takes the address while the code is in the mail, nothing changes and the request is removed", async () => {
    const user = await makeAccount("mona@example.test");
    const [session] = await sessionsOf(user.id);
    await start(user, "new@example.test");
    const code = await codeSentTo("new@example.test");
    await makeAccount("new@example.test"); // registered in the meantime
    await expect(confirm(user, session!.id, code)).rejects.toMatchObject({
      code: "CONFLICT",
      details: { issue: "email_unavailable" },
    });
    expect((await db().user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(user.email);
    expect(await db().emailChangeRequest.count()).toBe(0);
    expect(await sessionsOf(user.id)).toHaveLength(1);
  });

  it("another account cannot use the code of this request", async () => {
    const mona = await makeAccount("mona@example.test");
    const other = await makeAccount("other@example.test");
    await start(mona, "new@example.test");
    const code = await codeSentTo("new@example.test");
    await expect(confirm(other, (await sessionsOf(other.id))[0]!.id, code)).rejects.toMatchObject({
      details: { issue: "no_email_change" },
    });
    expect((await db().user.findUniqueOrThrow({ where: { id: other.id } })).email).toBe(
      other.email,
    );
  });

  it("is refused when the per-account verify limit is exceeded", async () => {
    const user = await makeAccount("mona@example.test");
    limiterAllows = false;
    await expect(confirm(user, (await sessionsOf(user.id))[0]!.id, "123456")).rejects.toMatchObject(
      {
        code: "RATE_LIMITED",
      },
    );
  });
});

describe("resend, discard and the cancel link", () => {
  it("a new code replaces the old one and resets the attempts", async () => {
    const user = await makeAccount("mona@example.test");
    const [session] = await sessionsOf(user.id);
    await start(user, "new@example.test");
    const first = await codeSentTo("new@example.test");
    await expect(
      confirm(user, session!.id, first === "111111" ? "222222" : "111111"),
    ).rejects.toBeDefined();

    await emailChange.resendEmailChangeCode({ userId: user.id, locale: "ar" });
    const rows = await outboxTo("new@example.test", "email-change-code");
    expect(rows).toHaveLength(2);
    expect(rows.at(-1)!.locale).toBe("ar");
    const second = (rows.at(-1)!.payload as { code: string }).code;
    expect(
      (await db().emailChangeRequest.findUniqueOrThrow({ where: { userId: user.id } })).attempts,
    ).toBe(0);
    if (second !== first)
      await expect(confirm(user, session!.id, first)).rejects.toMatchObject({
        details: { issue: "invalid_code" },
      });
    await expect(confirm(user, session!.id, second)).resolves.toMatchObject({ status: "changed" });
  });

  it("resend with nothing pending is refused", async () => {
    const user = await makeAccount("mona@example.test");
    await expect(
      emailChange.resendEmailChangeCode({ userId: user.id, locale: "en" }),
    ).rejects.toMatchObject({ details: { issue: "no_email_change" } });
  });

  it("the cancel link removes the request once, logs it, and the code then goes nowhere", async () => {
    const user = await makeAccount("mona@example.test");
    const [session] = await sessionsOf(user.id);
    await start(user, "new@example.test");
    const code = await codeSentTo("new@example.test");
    const [notice] = await outboxTo(user.email, "email-change-notice");
    const token = decodeURIComponent(
      (notice!.payload as { cancelUrl: string }).cancelUrl.split("#token=")[1]!,
    );

    expect(await emailChange.cancelEmailChangeByToken(token)).toEqual({ status: "cancelled" });
    expect(await db().emailChangeRequest.count()).toBe(0);
    expect(
      await db().securityEvent.count({
        where: { userId: user.id, type: "EMAIL_CHANGE_CANCELLED" },
      }),
    ).toBe(1);
    await expect(emailChange.cancelEmailChangeByToken(token)).rejects.toMatchObject({
      details: { issue: "invalid_token" },
    });
    await expect(confirm(user, session!.id, code)).rejects.toMatchObject({
      details: { issue: "no_email_change" },
    });
  });

  it("a made-up token cancels nothing", async () => {
    const user = await makeAccount("mona@example.test");
    await start(user, "new@example.test");
    await expect(emailChange.cancelEmailChangeByToken("A".repeat(43))).rejects.toMatchObject({
      details: { issue: "invalid_token" },
    });
    expect(await db().emailChangeRequest.count()).toBe(1);
  });

  it("'use a different address' drops the request and logs a cancellation only if there was one", async () => {
    const user = await makeAccount("mona@example.test");
    await emailChange.discardEmailChange(user.id);
    expect(await db().securityEvent.count({ where: { type: "EMAIL_CHANGE_CANCELLED" } })).toBe(0);
    await start(user, "new@example.test");
    await emailChange.discardEmailChange(user.id);
    expect(await db().emailChangeRequest.count()).toBe(0);
    expect(await db().securityEvent.count({ where: { type: "EMAIL_CHANGE_CANCELLED" } })).toBe(1);
  });
});

describe("what the page may show", () => {
  it("a pending change shows the masked address and attempts left; an expired one shows nothing", async () => {
    const user = await makeAccount("mona@example.test");
    expect(await emailChange.getPendingEmailChange(user.id)).toBeNull();
    await start(user, "new@example.test");
    const pending = await emailChange.getPendingEmailChange(user.id);
    expect(pending).toMatchObject({
      newEmailMasked: "n***@example.test",
      attemptsLeft: EMAIL_CHANGE_MAX_ATTEMPTS,
    });
    expect(
      await emailChange.getPendingEmailChange(user.id, {
        now: () => new Date(Date.now() + 31 * 60_000),
      }),
    ).toBeNull();
  });
});

describe("database rules", () => {
  it("refuses a plain code or token (hashes only), an un-normalized address, a negative counter and a second row per account", async () => {
    const user = await makeAccount("mona@example.test");
    const hash = "a".repeat(64);
    const base = {
      userId: user.id,
      newEmail: "x@example.test",
      codeHash: hash,
      cancelHash: "b".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    };
    await expect(
      db().emailChangeRequest.create({ data: { ...base, codeHash: "123456" } }),
    ).rejects.toThrow(/email_change_request_code_hash_check/);
    await expect(
      db().emailChangeRequest.create({ data: { ...base, cancelHash: "token" } }),
    ).rejects.toThrow(/email_change_request_cancel_hash_check/);
    await expect(
      db().emailChangeRequest.create({ data: { ...base, newEmail: "X@Example.test" } }),
    ).rejects.toThrow(/email_change_request_email_normalized_check/);
    await expect(
      db().emailChangeRequest.create({ data: { ...base, attempts: -1 } }),
    ).rejects.toThrow(/email_change_request_attempts_check/);
    await db().emailChangeRequest.create({ data: base });
    await expect(
      db().emailChangeRequest.create({ data: { ...base, cancelHash: "c".repeat(64) } }),
    ).rejects.toThrow();
  });

  it("the daily job deletes expired requests only, and deleting the account deletes its request", async () => {
    const user = await makeAccount("mona@example.test");
    await start(user, "new@example.test");
    const now = new Date(Date.now() + 31 * 60_000);
    const result = await authRepo.pruneAuthData(now, new Date(0), new Date(0));
    expect(result.emailChangeRequests).toBe(1);

    await start(user, "again@example.test");
    await db().user.delete({ where: { id: user.id } });
    expect(await db().emailChangeRequest.count()).toBe(0);
  });
});

describe("a password reset by email now sends the same notice (decided 2026-11-05)", () => {
  it("queues 'password-changed' with method reset, in the page language, with the device, and logs the reset", async () => {
    const user = await makeAccount("mona@example.test");
    await auth.requestPasswordReset(user.email, "en");
    const url = ((await outboxTo(user.email, "reset-password")).at(-1)!.payload as { url: string })
      .url;
    const token = decodeURIComponent(url.split("#token=")[1]!);
    await auth.resetPassword(token, NEW_PASSWORD, { locale: "ar", device: "firefox/macos" });

    const [notice] = await outboxTo(user.email, "password-changed");
    expect(notice).toBeDefined();
    expect(notice!.locale).toBe("ar");
    expect(notice!.payload).toMatchObject({ method: "reset", device: "firefox/macos" });
    expect((notice!.payload as { resetUrl: string }).resetUrl).toMatch(/\/ar\/forgot-password$/);
    expect(
      await db().securityEvent.count({ where: { userId: user.id, type: "PASSWORD_RESET" } }),
    ).toBe(1);
  });

  it("a failed reset (bad token) sends no notice", async () => {
    const user = await makeAccount("mona@example.test");
    await expect(
      auth.resetPassword("x".repeat(32), NEW_PASSWORD, { locale: "en" }),
    ).rejects.toBeDefined();
    expect(await outboxTo(user.email, "password-changed")).toHaveLength(0);
  });
});
