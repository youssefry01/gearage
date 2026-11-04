import { logger } from "@/lib/logger";
import { SECURITY_EVENT_RETENTION_DAYS } from "@/domain/account";
import { UNVERIFIED_ACCOUNT_DAYS } from "@/domain/auth";
import { pruneAuthData } from "@/server/repositories/auth.repository";
import { pruneCounters } from "@/server/repositories/rate-limit.repository";
import { dispatchDueEmails, pruneEmailOutbox } from "@/server/services/email.service";
import { expireReservations } from "@/server/services/inventory.service";
import { pruneOldZeroResults, runSearchIndexRebuild } from "@/server/services/search.service";

export type JobCadence = "tick" | "daily";
export type Job = { name: string; cadence: JobCadence; run: () => Promise<void> };

/**
 * Every job MUST be idempotent and safe to run twice (ADR 0007): Vercel cron is best-effort and may double-fire.
 * Later milestones register more here (low-stock digest, abandoned-cart email...).
 */
const jobs: Job[] = [
  {
    // Housekeeping only: availability already ignores expired reservations, so correctness never depends on this job.
    name: "expire-stock-reservations",
    cadence: "tick",
    run: async () => {
      await expireReservations();
    },
  },
  {
    // Safety net only: triggers keep the search index current (ADR 0019).
    name: "rebuild-search-index",
    cadence: "daily",
    run: runSearchIndexRebuild,
  },
  {
    name: "prune-search-zero-results",
    cadence: "daily",
    run: async () => {
      await pruneOldZeroResults();
    },
  },
  {
    // Sends queued emails that were not dispatched inline and retries failures with backoff (ADR 0022).
    name: "dispatch-email-outbox",
    cadence: "tick",
    run: async () => {
      await dispatchDueEmails();
    },
  },
  {
    // Housekeeping only: the counter SQL already ignores expired windows (ADR 0021).
    name: "prune-rate-limit-counters",
    cadence: "daily",
    run: async () => {
      await pruneCounters(new Date());
    },
  },
  {
    name: "prune-email-outbox",
    cadence: "daily",
    run: async () => {
      await pruneEmailOutbox();
    },
  },
  {
    // Deletes accounts never verified within a week (so a squatted address is freed), expired codes and reset tokens,
    // expired sessions, old lockout rows (M5a-2, ADR 0024) and security events older than about 12 months (M5b-1,
    // ADR 0025). Safe to run twice.
    name: "prune-auth-data",
    cadence: "daily",
    run: async () => {
      const now = new Date();
      const result = await pruneAuthData(
        now,
        new Date(now.getTime() - UNVERIFIED_ACCOUNT_DAYS * 86_400_000),
        new Date(now.getTime() - SECURITY_EVENT_RETENTION_DAYS * 86_400_000),
      );
      logger.info("auth_pruned", result);
    },
  },
  {
    name: "noop-heartbeat",
    cadence: "tick",
    run: async () => {
      logger.debug("job_heartbeat");
    },
  },
];

export type JobResult = { name: string; ok: boolean; ms: number };

export async function runJobs(cadence: JobCadence): Promise<JobResult[]> {
  const results: JobResult[] = [];
  for (const job of jobs.filter((j) => j.cadence === cadence)) {
    const start = performance.now();
    try {
      await job.run();
      results.push({ name: job.name, ok: true, ms: Math.round(performance.now() - start) });
    } catch (err) {
      logger.error("job_failed", { job: job.name, err });
      results.push({ name: job.name, ok: false, ms: Math.round(performance.now() - start) });
    }
  }
  return results;
}
