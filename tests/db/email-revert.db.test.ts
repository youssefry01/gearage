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
const { EMAIL_REVERT_DAYS } = await import("@/domain/email-change");

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
  const row = (
    await db().emailOutbox.findMany({ where: { toEmail: email }, orderBy: { createdAt: "asc" } })
  )
    .filter((r) => r.template === "verify-code")
    .at(-1)!;
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

type Acct = { id: string; email: string };

/** Moves the account to `to` the normal way (request, code, confirm) from its first session; returns the revert token. */
async function change(user: Acct, to: string, now?: Date): Promise<string> {
  const [session] = await sessionsOf(user.id);
  await start(user, to);
  await confirm(user, session!.id, await codeSentTo(to), now);
  const notices = await outboxTo(user.email, "email-changed");
  const url = (notices.at(-1)!.payload as { revertUrl: string }).revertUrl;
  return decodeURIComponent(url.split("#token=")[1]!);
}

const emailOf = async (id: string) => (await db().user.findUniqueOrThrow({ where: { id } })).email;

describe("a completed change leaves a way back", () => {
  it("reserves the old address, stores only a hash, and puts a 7-day undo link in the notice to the OLD address", async () => {
    const user = await makeAccount("mona@example.test");
    const token = await change(user, "new@example.test");
    expect(token).toHaveLength(43);

    const rows = await db().emailChangeRevert.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: user.id,
      oldEmail: "mona@example.test",
      newEmail: "new@example.test",
    });
    expect(JSON.stringify(rows[0])).not.toContain(token);
    expect(rows[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]!.expiresAt.getTime() - rows[0]!.createdAt.getTime()).toBe(
      EMAIL_REVERT_DAYS * 86_400_000,
    );
    const [told] = await outboxTo("mona@example.test", "email-changed");
    expect(told!.payload).toMatchObject({ revertDays: 7 });
  });

  it("nobody can register the reserved address: the answer, the email and the footprint are those of an existing account", async () => {
    const user = await makeAccount("mona@example.test");
    await change(user, "new@example.test");
    const usersBefore = await db().user.count();

    const answer = await auth.register(
      registerSchema.parse({
        firstName: "Sam",
        lastName: "Squatter",
        email: "mona@example.test",
        phone: "010 1234 5678",
        password: "another long passphrase 123",
        marketingConsent: false,
        acceptTerms: true,
      }),
      "en",
    );
    expect(answer).toEqual({ status: "check-email" });
    expect(await db().user.count()).toBe(usersBefore); // no account was created
    expect(await outboxTo("mona@example.test", "account-exists")).toHaveLength(1);
    expect(
      (await outboxTo("mona@example.test")).filter((r) => r.template === "verify-code").length,
    ).toBe(1); // only the one from the original registration
  });

  it("another account cannot move to the reserved address either: it takes the 'taken' path, with a request row and the same notice", async () => {
    const owner = await makeAccount("mona@example.test");
    await change(owner, "new@example.test");
    const other = await makeAccount("omar@example.test");

    await expect(start(other, "mona@example.test")).resolves.toEqual({ status: "code-sent" });
    expect(await db().emailChangeRequest.count({ where: { userId: other.id } })).toBe(1);
    expect(await outboxTo("mona@example.test", "email-change-taken")).toHaveLength(1);
    expect(await outboxTo("mona@example.test", "email-change-code")).toHaveLength(0);
  });

  it("the address becomes available again when the window ends (the ordinary registration works)", async () => {
    const user = await makeAccount("mona@example.test");
    await change(user, "new@example.test");
    const later = new Date(Date.now() + (EMAIL_REVERT_DAYS * 24 + 1) * 3_600_000);
    await auth.register(
      registerSchema.parse({
        firstName: "Sam",
        lastName: "Newcomer",
        email: "mona@example.test",
        phone: "010 1234 5678",
        password: "another long passphrase 123",
        marketingConsent: false,
        acceptTerms: true,
      }),
      "en",
      { now: () => later },
    );
    expect(await db().user.count({ where: { email: "mona@example.test" } })).toBe(1);
  });

  it("the account itself may take its own reserved address back with the normal flow (it is free for it)", async () => {
    const user = await makeAccount("mona@example.test");
    await change(user, "new@example.test");
    const back = { id: user.id, email: "new@example.test" };
    await start(back, "mona@example.test");
    expect(await outboxTo("mona@example.test", "email-change-code")).toHaveLength(1);
    const [session] = await sessionsOf(user.id);
    await confirm(back, session!.id, await codeSentTo("mona@example.test"));
    expect(await emailOf(user.id)).toBe("mona@example.test");
    // It holds the address again, so that address is no longer reserved against it, and the new one now is.
    const rows = await db().emailChangeRevert.findMany({ where: { userId: user.id } });
    expect(rows.map((r) => r.oldEmail)).toEqual(["new@example.test"]);
  });

  it("confirming is refused (and the request removed) if someone else's revert reserved the address after the request", async () => {
    const owner = await makeAccount("mona@example.test");
    const other = await makeAccount("omar@example.test");
    await start(other, "mona@example.test".replace("mona", "free")); // a request to a still-free address
    const code = await codeSentTo("free@example.test");
    // Meanwhile a reservation for exactly that address appears for another account.
    await db().emailChangeRevert.create({
      data: {
        userId: owner.id,
        oldEmail: "free@example.test",
        newEmail: "mona@example.test",
        tokenHash: "a".repeat(64),
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
      },
    });
    const [session] = await sessionsOf(other.id);
    await expect(confirm(other, session!.id, code)).rejects.toMatchObject({
      details: { issue: "email_unavailable" },
    });
    expect(await emailOf(other.id)).toBe("omar@example.test");
    expect(await db().emailChangeRequest.count({ where: { userId: other.id } })).toBe(0);
  });
});

describe("the undo link", () => {
  it("restores the old address, signs out EVERY device, disables the password, logs it, tells both addresses and emails a reset link", async () => {
    const user = await makeAccount("mona@example.test");
    await auth.login(user.email, PASSWORD, "en", { device: deviceFromUserAgent(FIREFOX_MAC) });
    const token = await change(user, "new@example.test");
    expect((await sessionsOf(user.id)).length).toBeGreaterThan(0);

    expect(await emailChange.revertEmailChangeByToken(token)).toEqual({ status: "reverted" });

    const after = await db().user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.email).toBe("mona@example.test");
    expect(after.emailVerified).toBe(true);
    expect(await sessionsOf(user.id)).toHaveLength(0);
    expect(await db().emailChangeRevert.count()).toBe(0);
    expect(
      await db().securityEvent.count({ where: { userId: user.id, type: "EMAIL_CHANGE_REVERTED" } }),
    ).toBe(1);
    expect(await outboxTo("mona@example.test", "email-reverted")).toHaveLength(1);
    expect(await outboxTo("new@example.test", "email-revert-released")).toHaveLength(1);
    const reset = await outboxTo("mona@example.test", "reset-password");
    expect(reset).toHaveLength(1);

    // The old password no longer works on the restored address; the address it left reaches no account.
    await expect(auth.login("mona@example.test", PASSWORD, "en")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    await expect(auth.login("new@example.test", PASSWORD, "en")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });

    // The emailed link sets a new password and the account is usable again.
    const link = (reset[0]!.payload as { url: string }).url;
    await auth.resetPassword(decodeURIComponent(link.split("#token=")[1]!), NEW_PASSWORD);
    await expect(auth.login("mona@example.test", NEW_PASSWORD, "en")).resolves.toEqual({
      status: "ok",
    });
  });

  it("works once: a second press, a made-up token and a pending change left over all end up refused or removed", async () => {
    const user = await makeAccount("mona@example.test");
    const token = await change(user, "new@example.test");
    await start({ id: user.id, email: "new@example.test" }, "later@example.test"); // a pending change
    await emailChange.revertEmailChangeByToken(token);
    expect(await db().emailChangeRequest.count()).toBe(0); // the account's pending change went with it
    await expect(emailChange.revertEmailChangeByToken(token)).rejects.toMatchObject({
      details: { issue: "invalid_token" },
    });
    await expect(emailChange.revertEmailChangeByToken("B".repeat(43))).rejects.toMatchObject({
      details: { issue: "invalid_token" },
    });
  });

  it("two simultaneous presses revert once", async () => {
    const user = await makeAccount("mona@example.test");
    const token = await change(user, "new@example.test");
    const results = await Promise.allSettled([
      emailChange.revertEmailChangeByToken(token),
      emailChange.revertEmailChangeByToken(token),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await outboxTo("mona@example.test", "email-reverted")).toHaveLength(1);
  });

  it("is refused after the window", async () => {
    const user = await makeAccount("mona@example.test");
    const token = await change(user, "new@example.test");
    const later = new Date(Date.now() + (EMAIL_REVERT_DAYS * 24 + 1) * 3_600_000);
    await expect(
      emailChange.revertEmailChangeByToken(token, { now: () => later }),
    ).rejects.toMatchObject({ details: { issue: "invalid_token" } });
    expect(await emailOf(user.id)).toBe("new@example.test");
  });

  it("two changes in a row: undoing the FIRST restores the first address and tells the address held at that moment", async () => {
    const user = await makeAccount("mona@example.test");
    const first = await change(user, "second@example.test");
    await change({ id: user.id, email: "second@example.test" }, "third@example.test");

    await emailChange.revertEmailChangeByToken(first);
    expect(await emailOf(user.id)).toBe("mona@example.test");
    expect(await outboxTo("third@example.test", "email-revert-released")).toHaveLength(1);
    expect(await db().emailChangeRevert.count({ where: { userId: user.id } })).toBe(0);
  });

  it("refuses, changes nothing and keeps the link when another account holds the old address (it points to support)", async () => {
    const user = await makeAccount("mona@example.test");
    const token = await change(user, "new@example.test");
    // Make the 'somehow taken' case: free the reservation, let another account take the address, put the row back.
    const row = (await db().emailChangeRevert.findMany())[0]!;
    await db().emailChangeRevert.delete({ where: { id: row.id } });
    await makeAccount("mona@example.test");
    await db().emailChangeRevert.create({ data: { ...row } });
    const sessionsBefore = await sessionsOf(user.id);

    await expect(emailChange.revertEmailChangeByToken(token)).rejects.toMatchObject({
      code: "CONFLICT",
      details: { issue: "address_unavailable" },
    });
    expect(await emailOf(user.id)).toBe("new@example.test");
    expect(await sessionsOf(user.id)).toHaveLength(sessionsBefore.length);
    expect(await db().emailChangeRevert.count({ where: { userId: user.id } })).toBe(1); // rolled back
    expect(await outboxTo("mona@example.test", "email-reverted")).toHaveLength(0);
    // The password still works: nothing was disabled.
    await expect(auth.login("new@example.test", PASSWORD, "en")).resolves.toEqual({ status: "ok" });
  });
});

describe("cancelling a pending change", () => {
  it("also signs out EVERY device and emails a password-reset link to the account's address", async () => {
    const user = await makeAccount("mona@example.test");
    await auth.login(user.email, PASSWORD, "en", { device: deviceFromUserAgent(FIREFOX_MAC) });
    await start(user, "new@example.test");
    const [notice] = await outboxTo(user.email, "email-change-notice");
    const token = decodeURIComponent(
      (notice!.payload as { cancelUrl: string }).cancelUrl.split("#token=")[1]!,
    );
    expect((await sessionsOf(user.id)).length).toBe(2);

    await emailChange.cancelEmailChangeByToken(token);

    expect(await sessionsOf(user.id)).toHaveLength(0);
    expect(await outboxTo("mona@example.test", "reset-password")).toHaveLength(1);
    expect(await emailOf(user.id)).toBe("mona@example.test");
    // The password is NOT disabled by a cancel (the owner chooses a new one with the link; decision open, ADR 0027).
    await expect(auth.login("mona@example.test", PASSWORD, "en")).resolves.toEqual({
      status: "ok",
    });
  });

  it("a dead link signs nobody out", async () => {
    const user = await makeAccount("mona@example.test");
    await expect(emailChange.cancelEmailChangeByToken("C".repeat(43))).rejects.toMatchObject({
      details: { issue: "invalid_token" },
    });
    expect(await sessionsOf(user.id)).toHaveLength(1);
  });
});

describe("database rules for the revert table", () => {
  const base = (userId: string) => ({
    userId,
    oldEmail: "old@example.test",
    newEmail: "new@example.test",
    tokenHash: "b".repeat(64),
    expiresAt: new Date(Date.now() + 86_400_000),
    createdAt: new Date(),
  });

  it("refuses a plain token, an un-normalized address, an upside-down window and a second reservation of one address", async () => {
    const user = await makeAccount("mona@example.test");
    const attempts = [
      { ...base(user.id), tokenHash: "plain-token" },
      { ...base(user.id), oldEmail: "Old@Example.test" },
      { ...base(user.id), expiresAt: new Date(Date.now() - 1000) },
    ];
    for (const data of attempts)
      await expect(db().emailChangeRevert.create({ data })).rejects.toThrow();
    await db().emailChangeRevert.create({ data: base(user.id) });
    await expect(
      db().emailChangeRevert.create({ data: { ...base(user.id), tokenHash: "c".repeat(64) } }),
    ).rejects.toThrow(); // oldEmail is unique
  });

  it("the daily job deletes expired rows only, and deleting the account deletes its rows", async () => {
    const user = await makeAccount("mona@example.test");
    await db().emailChangeRevert.create({ data: base(user.id) });
    const early = await authRepo.pruneAuthData(new Date(), new Date(0), new Date(0));
    expect(early.emailChangeReverts).toBe(0);
    const late = await authRepo.pruneAuthData(
      new Date(Date.now() + 2 * 86_400_000),
      new Date(0),
      new Date(0),
    );
    expect(late.emailChangeReverts).toBe(1);
    await db().emailChangeRevert.create({ data: base(user.id) });
    await db().user.delete({ where: { id: user.id } });
    expect(await db().emailChangeRevert.count()).toBe(0);
  });
});
