# ADR 0024: Authentication flows, anti-enumeration and progressive lockout

Status: accepted (M5a-2). Builds on [0002](0002-auth-better-auth.md), [0003](0003-password-hashing.md), [0021](0021-rate-limiting.md) and [0022](0022-email-and-outbox.md).

## Decisions

1. **Better Auth's HTTP handler is not mounted.** There is no `app/api/auth`. Every flow is a Server Action
   (`publicAction`/`authedAction`) that applies our rate limit first and then calls `auth.api.*` in process. A structure
   test fails if the handler appears. Trade-off: no OAuth callback URL yet; when social login is added, that one route
   is mounted deliberately and reviewed on its own.
2. **Email is verified with a 6-digit code** (Better Auth email OTP plugin): valid 10 minutes, hashed at rest, destroyed
   after 5 wrong guesses, plus a per-email and a per-IP limit. A successful verification signs the person in.
3. **Registering an existing address looks identical to a new registration** (same response, at least 1.2 s). The owner
   gets an "account already exists" email instead. Password and date-of-birth problems are reported because they say
   nothing about the address.
4. **Login** order: per-IP limit, per-email limit (keyed by the typed address, never by existence), lockout check
   (before any hash is spent), Better Auth. Unknown addresses cost one dummy Argon2 hash, like a wrong password.
5. **Progressive lockout** in `login_throttle`, keyed by an HMAC of the normalized email (no address stored, and unknown
   addresses are throttled like real ones): free for 4 failures, then 30 s, 1, 2, 5, 10 and 15 minutes (cap). Failures
   older than an hour stop counting. A successful sign-in or a password reset clears it. Accepted cost: someone who knows
   an address can keep it locked for at most 15 minutes at a time (the owner can always reset by email, which unlocks).
6. **Reset by link, consumed on POST.** The token is in the URL fragment (`#token=`), so it never reaches a server log,
   CDN log or Referer, and an email scanner that opens the link cannot use it up. The page POSTs it with the new password.
   The password policy runs before the token is consumed. On success: all sessions revoked, lockout cleared, the address
   counts as verified (the owner proved the inbox).
7. **Sessions**: opaque token in an HttpOnly, SameSite=Lax cookie (`__Secure-` prefix and Secure over https), host-only,
   7 days, renewed at most daily, looked up in the database on every request (no cookie cache), no IP stored.
8. **CSRF**: Next.js Server Actions reject a request whose `Origin` differs from the host; SameSite=Lax keeps the cookie
   off cross-site POSTs; a replay test proves a foreign-origin action call is refused and sets no session.
9. **Consent** is stored on `user` (terms and privacy: accepted-at and version; marketing: flag and time).
10. **The page language is an action input**, validated against the supported locales (`getLocale()` does not work in
    Server Actions). It only chooses the language of emails.

## Known limits

- **Pre-registration squatting**: an attacker can register a victim's address with a password they chose. If the victim
  then types the unsolicited code, the attacker holds a verified account. Mitigations: the email says to ignore it, unverified
  accounts are deleted after 7 days (daily job), and a password reset replaces the password and revokes sessions.
- Lockout lets an attacker nuisance-lock a known address for up to 15 minutes at a time.
- Breach checking (HIBP) fails open; the policy then still enforces length.
