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

Planned: audit log (M5b), webhook HMAC (M7), security headers + CSP (M13a).

Added in M5a-2 (sign-in flows; [ADR 0024](adr/0024-auth-flows-and-lockout.md)):

- Better Auth's HTTP handler is **not mounted**; all flows are rate-limited Server Actions. Sessions are HttpOnly, SameSite=Lax, Secure over https, host-only, 7 days, checked in the database on every request.
- No account enumeration in register, login, verify, resend or forgot password (same text, a 1.2 s floor, per-email limits keyed by the typed address). Progressive lockout is keyed by a hash of the address, so unknown addresses lock too.
- Reset tokens live in the URL fragment and are consumed by a POST; a reset revokes all sessions.
- Daily job deletes unverified accounts after 7 days and expired codes, tokens, sessions and lockout rows.

## Auth threat-model checklist

Re-check this list whenever auth code changes. "Test" names the automated proof; "Manual" is in [AUTH_MANUAL_TESTS.md](AUTH_MANUAL_TESTS.md).

| Threat                                | Control                                                                                        | Test                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Password guessing (online)            | Per-IP and per-email limits (fail closed), progressive lockout, Argon2id 64 MiB                | auth.db "locks progressively", e2e lockout (real+unknown) |
| Credential stuffing                   | Same limits; breached-password check at registration/reset                                     | password-policy tests                                     |
| Account enumeration                   | Identical responses and 1.2 s floor; unknown address costs a dummy hash; lockout keyed by hash | auth.db "same answer", e2e "same message"                 |
| Verification-code brute force         | 6 digits, 5 guesses per code, per-email and per-IP limits, 10 min expiry, hashed at rest       | auth.db "too many wrong guesses"                          |
| Reset token theft or reuse            | 60 min, single use, in fragment (no log/Referer), consumed on POST, sessions revoked           | auth.db reset suite, e2e "single-use"                     |
| Session theft by script (XSS)         | HttpOnly cookie, nothing readable from JS                                                      | e2e cookie flags                                          |
| Session on plain http / sibling sites | Secure + `__Secure-` prefix over https, host-only (no Domain)                                  | auth-cookies.db (https)                                   |
| CSRF                                  | Server Action Origin check, SameSite=Lax, no mounted handler                                   | e2e foreign-origin replay; structure test                 |
| Open redirect after login             | `safeNextPath` allows same-site paths only                                                     | domain unit tests, e2e                                    |
| Stolen database                       | Argon2id + pepper (env only), codes hashed, no raw IP/email in limiter keys, no IP on sessions | auth.db hash format                                       |
| Weak hash left behind                 | Rehash on login when pepper version or parameters changed                                      | auth.db rehash                                            |
| Logging secrets                       | No password, code, token or email in logs; codes cleared from the outbox after sending         | review + email.service tests                              |
| Pre-registration squatting            | Residual (see ADR 0024); 7-day purge, reset replaces password                                  | auth.db purge, reset verifies address                     |
| Forgotten authorization on mutations  | `authedAction` checks the session first; every action declares a policy                        | structure test                                            |

Not yet covered (later milestones): security headers and CSP (M13a), audit log and sessions list (M5b), admin TOTP (M5b), webhook HMAC (M7).

Report vulnerabilities privately to the repository owner; do not open public issues for security problems.
