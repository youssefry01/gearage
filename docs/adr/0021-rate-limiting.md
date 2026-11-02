# ADR 0021: Rate limiting (Upstash with a Postgres fallback)

Status: Accepted (M5a-1)

## Context

Public reads (search suggestions, product cards, status), view tracking and, from M5a-2, every authentication endpoint need limits per client. Upstash Redis (free tier) is the fast store; it can fail or be unconfigured. Postgres is already there.

## Decisions

- **Algorithm:** a fixed window per key: `INCR`, `EXPIRE NX` and `PTTL` in one Redis pipeline; in Postgres one atomic `INSERT ... ON CONFLICT DO UPDATE` that restarts an expired window in the same statement (tested with 40 concurrent hits yielding exactly the counts 1 to 40). A hit over the maximum is refused; the window does not slide.
- **Chain:** Upstash (if both REST values are set and not in test mode) -> on any error or an 800 ms timeout, Postgres -> if that also fails, the policy's `failMode`. After an Upstash error it is skipped for 30 s (circuit breaker) so requests do not each wait for its timeout. No Redis retries.
- **Counters are separate per store**, so a switch restarts the window. Accepted. The account lockout (M5a-2) lives in Postgres only and does not depend on this.
- **Failure policy per endpoint** (defined once in `src/domain/rate-limit.ts`, a test enforces it):

  | Policy group                                        | Both stores down                                      |
  | --------------------------------------------------- | ----------------------------------------------------- |
  | `auth.*` (login, register, code send/verify, reset) | **fail closed**: 503 `UNAVAILABLE`, `Retry-After`     |
  | `search.suggest`, `products.cards`, `status`        | **fail open**: the request is served                  |
  | `product.view.*`                                    | **fail open and quiet**: 204, the view is not counted |

  Failing closed on auth costs nothing real: with Postgres down, sign-in is down anyway.

- **Keys store no personal data:** `<policy>:<first 32 hex of HMAC-SHA256(key derived from AUTH_SECRET, subject)>`. No raw IP or email in Redis or Postgres. Expired Postgres rows are deleted by a daily job (the SQL ignores them anyway).
- **Client IP** (`src/server/security/client-ip.ts`): forwarding headers are forgeable, so they are read only on Vercel (`VERCEL=1`, `x-vercel-forwarded-for` first) or with `TRUST_PROXY_HEADERS=1`. The **rightmost** `x-forwarded-for` entry is used, correct whether the proxy replaces or appends. Values that are not IP addresses are ignored. IPv6 is reduced to its /64. With no trusted IP, one shared `unknown` bucket applies (local development). **Not yet verified on a live Vercel deployment.**
- **HTTP:** 429 `RATE_LIMITED` with `Retry-After` and the standard error body; `Cache-Control: no-store`. Server Actions get the same policies from the `publicAction` middleware, which refuses before validating input.
- **Test safety:** in test mode Upstash is never used. `RATE_LIMIT_SCALE` (test only, refused in production) multiplies every maximum so parallel e2e workers sharing one IP are not throttled; the real values are covered by DB tests.

## Consequences

`/api/status` can answer 429 for a client over its limit (all other visitors still get 200). Policy numbers are defaults to tune once there is traffic. The Upstash SDK is imported in exactly one file (ESLint rule).
