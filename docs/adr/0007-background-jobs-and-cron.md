# ADR 0007: Background work within Vercel Hobby cron limits

Status: Accepted (limits verified 2026-10-09 against Vercel docs updated 2026-01-28)
Verified Hobby limits: cron at most once per day (more frequent expressions fail the deploy); timing only within the scheduled hour (+/-59 min); 100 cron jobs per project (older docs said 2 per account: do not rely on more than 2); GET requests only; production deployments only; delivery is best-effort and a run can fire twice. Pro allows per-minute schedules.
Principle: correctness never depends on cron. Cron only does housekeeping and retries; every job is idempotent and safe to run twice.

- Outbox email: sent right after the response via `after()`; failures stay in `EmailOutbox`; a sweeper retries with backoff (rows claimed with `FOR UPDATE SKIP LOCKED`).
- Reservation expiry: availability is computed from unexpired reservations (ADR 0008), so no job is needed for correctness. Housekeeping marks rows EXPIRED.
- Payment reconciliation: webhook first; lazy status query when a pending order or return page loads; the tick job reconciles stale pending payments.
- Alerts: daily Vercel cron (e.g. 03:00 UTC) sends a low-stock/failed-outbox digest; Sentry alerts for errors.
- Sub-daily trigger: GitHub Actions scheduled workflow (about every 10 min, best-effort) calls `/api/cron/tick` with `Authorization: Bearer $CRON_SECRET`. Caveat: GitHub disables schedules on public repos after 60 days of inactivity; an external free pinger is the fallback. On Vercel Pro, move `tick` to a per-minute Vercel cron (config-only change).
- Endpoints: `/api/cron/tick`, `/api/cron/daily`; constant-time CRON_SECRET check.
