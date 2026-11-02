# Security (expanded in M5a, again in M13a)

Implemented in M0:

- Env validated at boot; secrets only from environment variables, never committed (`.env*` ignored except `.env.example`).
- Cron endpoints: constant-time Bearer check (SHA-256 digests compared with `timingSafeEqual`), `401` otherwise, `no-store`.
- Error responses never leak internals; unknown errors return a generic `INTERNAL` message and are logged server-side.
- `X-Powered-By` disabled. `npm audit` (high+) blocks CI; see [ADR 0011](adr/0011-dependency-pins-and-overrides.md).

Added in M1a:

- `prisma/guard.ts`: destructive Prisma commands and the seed refuse any non-local database host (no override); production only runs `migrate deploy`.
- Settings URLs (social links) are validated as `https` only, so `javascript:` and `data:` can never reach an `href`.
- The theme script is a constant string: a future CSP can allow it by SHA-256 hash (no nonce, pages stay static).

Added in M1b:

- `/api/status` exposes only three coarse states and a fixed component list (no versions, hosts, latencies or errors); one DB probe per 30s per instance, CDN-cacheable, 200 for normal visits, 429 only for a client over its per-IP limit (M5a-1).
- Cookie consent is recorded first-party (version + timestamp); non-essential storage stays off until the visitor opts in. Search input is length-limited and submitted by plain GET.

Added in M2a:

- Database-level integrity (CHECK constraints, triggers, append-only stock history) means no code path, including hand-run SQL, can create negative stock, nested bundles or edit stock history.
- `npm run test:db` can only ever touch a local database whose name ends in `_test` and that is not the development database (three layers of checks).
- Image uploads are validated by content (magic bytes), never by the client's declared type; SVG uploads are refused; storage keys cannot traverse directories; writes are confined to the storage root.

Added in M5a-1 (infrastructure; the sign-in flows follow in M5a-2):

- **Passwords:** Argon2id (64 MiB, t=3, p=1) with a per-hash random salt and a versioned server-side pepper, NFKC-normalized, 12 to 128 characters, no composition rules, rejected if in the Pwned Passwords corpus (k-anonymity, fails open). **Losing or changing `PASSWORD_PEPPER` invalidates every stored password**; rotation procedure in [ADR 0003](adr/0003-password-hashing.md).
- **Rate limiting:** Upstash with a Postgres fallback, per-endpoint fail-open/fail-closed, keys are keyed hashes (no raw IP or email stored). Client IP only from a trusted proxy. See [ADR 0021](adr/0021-rate-limiting.md).
- **Email:** an outbox so a request never waits on, or reveals, whether an address exists; secrets in queued messages are cleared as soon as they are sent or expire; tests can never send real email. See [ADR 0022](adr/0022-email-and-outbox.md).
- **View counting:** cookieless, no identifier stored. See [ADR 0023](adr/0023-view-tracking.md).
- **Server Actions** are defined only through `publicAction` (rate limit first, then input validation; unexpected errors reach the client as a generic message). SDKs for Argon2, Upstash and next-safe-action can each be imported in one place only (ESLint).
- **No account enumeration** is a design rule for M5a-2 (same message and comparable timing for login, register, forgot password and resend code); the building blocks (`verifyAgainstDummy`, `withMinimumDuration`, the outbox) are tested here.

Planned: sessions, CSRF review, lockout and the auth flows (M5a-2), audit log (M5b), webhook HMAC (M7), security headers + CSP (M13a).

Report vulnerabilities privately to the repository owner; do not open public issues for security problems.
