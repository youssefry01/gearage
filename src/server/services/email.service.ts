import {
  emailPayloads,
  isExpired,
  nextAttemptAt,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_RETENTION_DAYS,
  outboxExpiry,
  type EmailPayload,
  type EmailTemplate,
} from "@/domain/email-outbox";
import type { Locale } from "@/i18n/locales";
import { logger } from "@/lib/logger";
import { getEmailProvider } from "@/server/email/provider";
import { renderEmail } from "@/server/email/render";
import type { EmailProvider } from "@/server/email/types";
import * as repo from "@/server/repositories/email-outbox.repository";

type Deps = { provider?: EmailProvider; now?: Date };

export type EnqueueInput<T extends EmailTemplate> = {
  template: T;
  to: string;
  locale: Locale;
  payload: EmailPayload<T>;
};

/**
 * Queues an email (ADR 0022). Call it from the same transaction as the change that needs it (pass `db`), so an email
 * is queued if and only if the change committed. It never sends: the request stays fast and the response never
 * depends on whether the address exists. Returns the row id for `dispatchEmail`.
 */
export async function enqueueEmail<T extends EmailTemplate>(
  input: EnqueueInput<T>,
  options: { db?: Parameters<typeof repo.insertOutbox>[1]; now?: Date } = {},
): Promise<string> {
  const payload = emailPayloads[input.template].parse(input.payload) as Record<string, unknown>;
  const now = options.now ?? new Date();
  return repo.insertOutbox(
    {
      template: input.template,
      locale: input.locale,
      toEmail: input.to.trim().toLowerCase(),
      payload: payload as never,
      nextAttemptAt: now,
      expiresAt: outboxExpiry(input.template, payload, now),
      createdAt: now,
    },
    options.db,
  );
}

async function processRow(
  row: repo.ClaimedEmail,
  provider: EmailProvider,
  now: Date,
): Promise<"sent" | "retry" | "ended"> {
  if (isExpired(row.expiresAt, now)) {
    await repo.markEnded(row.id, "EXPIRED", "expired before sending");
    return "ended";
  }
  let message;
  try {
    const rendered = await renderEmail(
      row.template as EmailTemplate,
      row.locale as Locale,
      row.payload,
    );
    message = { to: row.toEmail, ...rendered };
  } catch (err) {
    // A message that cannot be rendered will never render: retrying would only repeat the bug.
    logger.error("email_render_failed", { id: row.id, template: row.template, err });
    await repo.markEnded(row.id, "FAILED", "render error");
    return "ended";
  }
  const result = await provider.send(message);
  if (result.ok) {
    await repo.markSent(row.id, result.messageId, now);
    return "sent";
  }
  if (!result.retryable || row.attempts >= OUTBOX_MAX_ATTEMPTS) {
    logger.warn("email_failed", { id: row.id, template: row.template, reason: result.reason });
    await repo.markEnded(row.id, "FAILED", result.reason);
    return "ended";
  }
  await repo.markRetry(row.id, nextAttemptAt(row.attempts, now), result.reason);
  return "retry";
}

/** Sends one queued email now (best effort, after the transaction committed). Failures stay queued for the job. */
export async function dispatchEmail(
  id: string,
  deps: Deps = {},
): Promise<"sent" | "retry" | "ended" | "skipped"> {
  const now = deps.now ?? new Date();
  const [row] = await repo.claimDue(now, 1, id);
  if (!row) return "skipped";
  try {
    return await processRow(row, deps.provider ?? getEmailProvider(), now);
  } catch (err) {
    logger.error("email_dispatch_failed", { id, err });
    await repo
      .markRetry(id, nextAttemptAt(row.attempts, now), "internal error")
      .catch(() => undefined);
    return "retry";
  }
}

export type DispatchSummary = { expired: number; sent: number; retried: number; ended: number };

/** Job: expire stale rows, then send what is due (retries after a failure, rows nobody dispatched). */
export async function dispatchDueEmails(
  deps: Deps & { limit?: number } = {},
): Promise<DispatchSummary> {
  const now = deps.now ?? new Date();
  const summary: DispatchSummary = {
    expired: await repo.expireStale(now),
    sent: 0,
    retried: 0,
    ended: 0,
  };
  const rows = await repo.claimDue(now, deps.limit ?? 25);
  const provider = deps.provider ?? getEmailProvider();
  for (const row of rows) {
    try {
      const outcome = await processRow(row, provider, now);
      if (outcome === "sent") summary.sent++;
      else if (outcome === "retry") summary.retried++;
      else summary.ended++;
    } catch (err) {
      logger.error("email_dispatch_failed", { id: row.id, err });
      await repo
        .markRetry(row.id, nextAttemptAt(row.attempts, now), "internal error")
        .catch(() => undefined);
      summary.retried++;
    }
  }
  return summary;
}

/** Job: delete finished rows after the retention period. */
export async function pruneEmailOutbox(now: Date = new Date()): Promise<number> {
  await repo.expireStale(now);
  return repo.pruneFinished(new Date(now.getTime() - OUTBOX_RETENTION_DAYS * 86_400_000));
}
