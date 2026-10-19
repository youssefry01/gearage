import { logger } from "@/lib/logger";
import { expireReservations } from "@/server/services/inventory.service";

export type JobCadence = "tick" | "daily";
export type Job = { name: string; cadence: JobCadence; run: () => Promise<void> };

/**
 * Every job MUST be idempotent and safe to run twice (ADR 0007): Vercel cron is best-effort and may double-fire.
 * Real jobs (outbox sweeper, reservation expiry, low-stock digest...) register here in later milestones.
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
