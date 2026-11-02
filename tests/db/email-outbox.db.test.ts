import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dispatchDueEmails,
  dispatchEmail,
  enqueueEmail,
  pruneEmailOutbox,
} from "@/server/services/email.service";
import type { EmailProvider, SendResult } from "@/server/email/types";
import { db, resetData } from "./helpers";

beforeEach(resetData);

const t0 = new Date("2026-10-30T12:00:00.000Z");
const at = (min: number) => new Date(t0.getTime() + min * 60_000);

function provider(results: SendResult[] | SendResult = { ok: true, messageId: "m-1" }) {
  const queue = Array.isArray(results) ? [...results] : null;
  const send = vi.fn(async () =>
    queue ? (queue.shift() ?? { ok: true as const, messageId: "m-x" }) : (results as SendResult),
  );
  return { send, impl: { name: "log", send } as EmailProvider };
}
const code = {
  template: "verify-code",
  to: "Buyer@Example.com",
  locale: "en",
  payload: { code: "493021", expiresMinutes: 10 },
} as const;

const row = async (id: string) => db().emailOutbox.findUniqueOrThrow({ where: { id } });

describe("email outbox", () => {
  it("queues a normalized recipient, with the code, due now and expiring with the code", async () => {
    const id = await enqueueEmail(code, { now: t0 });
    const r = await row(id);
    expect(r).toMatchObject({
      toEmail: "buyer@example.com",
      status: "PENDING",
      attempts: 0,
      payload: { code: "493021", expiresMinutes: 10 },
    });
    expect(r.expiresAt.toISOString()).toBe(at(10).toISOString());
  });
  it("sends, marks SENT, stores the provider id and CLEARS the code", async () => {
    const p = provider();
    const id = await enqueueEmail(code, { now: t0 });
    expect(await dispatchEmail(id, { provider: p.impl, now: at(1) })).toBe("sent");
    const r = await row(id);
    expect(r).toMatchObject({ status: "SENT", providerMessageId: "m-1", payload: {}, attempts: 1 });
    expect(p.send).toHaveBeenCalledTimes(1);
    const sent = p.send.mock.calls[0] as unknown as [{ to: string; text: string }];
    expect(sent[0].to).toBe("buyer@example.com");
    expect(sent[0].text).toContain("493021");
  });
  it("does not send the same row twice, even when dispatched concurrently", async () => {
    const p = provider();
    const id = await enqueueEmail(code, { now: t0 });
    const results = await Promise.all([
      dispatchEmail(id, { provider: p.impl, now: at(1) }),
      dispatchEmail(id, { provider: p.impl, now: at(1) }),
      dispatchDueEmails({ provider: p.impl, now: at(1) }),
    ]);
    expect(p.send).toHaveBeenCalledTimes(1);
    expect(
      results.filter((r) => r === "sent" || (typeof r === "object" && r.sent === 1)),
    ).toHaveLength(1);
  });
  it("retries a temporary failure with backoff, then succeeds", async () => {
    const p = provider([
      { ok: false, retryable: true, reason: "brevo 503" },
      { ok: true, messageId: "m-2" },
    ]);
    const id = await enqueueEmail(
      {
        ...code,
        template: "reset-password",
        payload: { url: "https://shop.example/r?t=1", expiresMinutes: 60 },
      },
      { now: t0 },
    );
    expect(await dispatchEmail(id, { provider: p.impl, now: at(1) })).toBe("retry");
    let r = await row(id);
    expect(r).toMatchObject({ status: "PENDING", attempts: 1, lastError: "brevo 503" });
    expect(r.nextAttemptAt.toISOString()).toBe(at(2).toISOString()); // 1 minute backoff
    expect(r.payload).not.toEqual({}); // still needed for the retry
    expect((await dispatchDueEmails({ provider: p.impl, now: at(1.5) })).sent).toBe(0); // not due yet
    expect((await dispatchDueEmails({ provider: p.impl, now: at(2) })).sent).toBe(1);
    r = await row(id);
    expect(r).toMatchObject({ status: "SENT", attempts: 2, payload: {} });
  });
  it("gives up at once on a permanent failure and clears the secret", async () => {
    const p = provider({ ok: false, retryable: false, reason: "brevo 401 unauthorized" });
    const id = await enqueueEmail(code, { now: t0 });
    expect(await dispatchEmail(id, { provider: p.impl, now: at(1) })).toBe("ended");
    expect(await row(id)).toMatchObject({
      status: "FAILED",
      payload: {},
      lastError: "brevo 401 unauthorized",
    });
  });
  it("gives up after five attempts of a temporary failure", async () => {
    const p = provider({ ok: false, retryable: true, reason: "brevo 503" });
    const id = await enqueueEmail(
      {
        ...code,
        template: "reset-password",
        payload: { url: "https://shop.example/r?t=1", expiresMinutes: 24 * 60 },
      },
      { now: t0 },
    );
    let minute = 1;
    for (let i = 0; i < 5; i++) {
      await dispatchDueEmails({ provider: p.impl, now: at(minute) });
      minute += 200;
    }
    expect(p.send).toHaveBeenCalledTimes(5);
    expect(await row(id)).toMatchObject({ status: "FAILED", attempts: 5, payload: {} });
  });
  it("never sends a code after it expired, and clears it", async () => {
    const p = provider();
    const id = await enqueueEmail(code, { now: t0 });
    expect(await dispatchEmail(id, { provider: p.impl, now: at(11) })).toBe("ended");
    expect(p.send).not.toHaveBeenCalled();
    expect(await row(id)).toMatchObject({ status: "EXPIRED", payload: {} });
  });
  it("the sweeper expires stale unsent rows so no secret outlives its use", async () => {
    const id = await enqueueEmail(code, { now: t0 });
    const summary = await dispatchDueEmails({ provider: provider().impl, now: at(30) });
    expect(summary.expired).toBe(1);
    expect(await row(id)).toMatchObject({ status: "EXPIRED", payload: {} });
  });
  it("recovers a row whose worker died mid-send once the lease ran out", async () => {
    const id = await enqueueEmail(
      {
        ...code,
        template: "reset-password",
        payload: { url: "https://shop.example/r?t=1", expiresMinutes: 60 },
      },
      { now: t0 },
    );
    await db()
      .$executeRaw`UPDATE "email_outbox" SET "status" = 'SENDING', "lockedUntil" = ${new Date(t0.getTime() + 120_000)}::timestamp, "attempts" = 1 WHERE "id" = ${id}::uuid`;
    const p = provider();
    expect((await dispatchDueEmails({ provider: p.impl, now: at(1) })).sent).toBe(0); // lease still held
    expect((await dispatchDueEmails({ provider: p.impl, now: at(3) })).sent).toBe(1);
  });
  it("prunes finished rows after 7 days but never a pending one", async () => {
    const sentId = await enqueueEmail(code, { now: t0 });
    await dispatchEmail(sentId, { provider: provider().impl, now: at(1) });
    const pendingId = await enqueueEmail(
      {
        ...code,
        template: "reset-password",
        payload: { url: "https://shop.example/r?t=1", expiresMinutes: 24 * 60 },
      },
      { now: t0 },
    );
    expect(await pruneEmailOutbox(at(60 * 24 * 6))).toBe(0);
    expect(await pruneEmailOutbox(at(60 * 24 * 8))).toBe(2); // the pending one expired (24 h) and was then pruned
    expect(await db().emailOutbox.count({ where: { id: { in: [sentId, pendingId] } } })).toBe(0);
  });
  it("the database refuses a finished row that still holds its secret", async () => {
    const id = await enqueueEmail(code, { now: t0 });
    await expect(
      db().$executeRaw`UPDATE "email_outbox" SET "status" = 'SENT' WHERE "id" = ${id}::uuid`,
    ).rejects.toThrow(/email_outbox_payload_cleared_chk/);
  });
  it("rejects an invalid payload before anything is stored", async () => {
    await expect(
      enqueueEmail({ ...code, payload: { code: "12", expiresMinutes: 10 } } as never),
    ).rejects.toThrow();
    expect(await db().emailOutbox.count()).toBe(0);
  });
});
