# Security (stub, expanded in M5a and M13a)

Implemented in M0:

- Env validated at boot; secrets only from environment variables, never committed (`.env*` ignored except `.env.example`).
- Cron endpoints: constant-time Bearer check (SHA-256 digests compared with `timingSafeEqual`), `401` otherwise, `no-store`.
- Error responses never leak internals; unknown errors return a generic `INTERNAL` message and are logged server-side.
- `X-Powered-By` disabled. `npm audit` (high+) blocks CI; see [ADR 0011](adr/0011-dependency-pins-and-overrides.md).

Added in M1a:

- `prisma/guard.ts`: destructive Prisma commands and the seed refuse any non-local database host (no override); production only runs `migrate deploy`.
- Settings URLs (social links) are validated as `https` only, so `javascript:` and `data:` can never reach an `href`.
- The theme script is a constant string: a future CSP can allow it by SHA-256 hash (no nonce, pages stay static).

Planned: security headers + CSP (M13a), Argon2id + HIBP + rate limiting (M5a), webhook HMAC (M7), audit log (M5b).

Report vulnerabilities privately to the repository owner; do not open public issues for security problems.
