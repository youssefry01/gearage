# ADR 0025: Account area, sessions list and security activity (M5b-1)

Status: accepted (owner decisions of 2026-11-04). Related: [0002](0002-auth-better-auth.md), [0003](0003-password-hashing.md),
[0021](0021-rate-limiting.md), [0022](0022-email-and-outbox.md), [0024](0024-auth-flows-and-lockout.md).

## Context

M5a made registration and sign-in work. The signed-in person also needs to see and control their account: profile,
password, which devices are signed in, and what happened recently. These features handle sensitive data, so each choice
below leans toward collecting less.

## Decisions

1. **Device label, not User-Agent, and no IP.** A session records only a coarse label derived at sign-in: a browser
   family and an operating system. It is stored as two language-neutral codes, `<browser>/<os>` (for example
   `chrome/windows`), so the list shows "Chrome on Windows" in English and the Arabic equivalent in Arabic from the same
   row. The Server Action derives the label (`src/domain/device.ts`, a small hand-written parser; no library) and passes
   only the label on. Better Auth is called without request headers, so it never sees the User-Agent or the IP. A
   `databaseHooks.session.create.before` hook stores the label from the per-call context and forces Better Auth's own
   `userAgent` and `ipAddress` columns to NULL. A CHECK constraint limits the column to the `a-z0-9-/` shape, so a raw
   User-Agent (spaces, parentheses, semicolons) cannot be stored even by mistake. Sessions created before the migration
   have no label and show as "Unknown device".
2. **Security activity log.** Table `security_event`: type and time, plus the same device label on `SIGN_IN` events only
   (a CHECK enforces it). No IP, no other metadata. Types: `SIGN_IN`, `PASSWORD_CHANGED`, `PASSWORD_RESET`,
   `SESSION_REVOKED`, `OTHER_SESSIONS_REVOKED`. Sign-ins are written by a `session.create.after` hook, so every flow that
   creates a session is covered (password sign-in and the automatic sign-in after email verification). A logging failure
   never fails the action it describes. The daily `prune-auth-data` job deletes rows older than 365 days ("about 12
   months"). Rows are deleted with the account.
3. **Failed sign-ins are not logged.** Writing a row only for real accounts would make the response slower for existing
   addresses and leak enumeration through timing (ADR 0024 item 5). The lockout table already covers abuse.
4. **Password change** (signed in): checks, in order, a per-account limit counted on every attempt (6 per 15 minutes,
   fail closed; plus 20 per 15 minutes per IP), the current password (so a wrong one never costs a breach-list lookup),
   "different from the current one", then the policy and breach check. One transaction then replaces the hash with a
   compare-and-set against the hash that was verified (a concurrent reset wins and the change is refused), deletes every
   session except the current one, writes the event and queues the notice email. The current session stays signed in.
   We do not call Better Auth's `changePassword`: it would re-create the current session, and we need the transaction.
5. **Notice email** `password-changed`: names the device and links to the forgot-password page ("if this wasn't you, reset
   now"). Its payload accepts only a device code and an http(s) URL. It is kept 24 hours in the outbox (a late notice is
   still worth reading). A reset by email is logged but sends no notice (the reset itself arrived by email).
6. **Sessions list.** Shows live sessions of the signed-in account only: this device first and marked, device label,
   sign-in time, and last activity as a date (Better Auth refreshes `updatedAt` at most once a day, so a precise time
   would be false). Per-device "Sign out" for other devices, and one bulk action, "Sign out of other devices", that keeps
   the current session. There is no "sign out everywhere": the normal Sign out covers this device. The session `token`
   (the cookie secret) is never selected; the list uses the session `id`. Revoking is scoped by the user id, so another
   account's session id deletes nothing, and the answer is the same whether or not the id existed.
7. **Profile.** Name, Egyptian mobile, optional date of birth (minimum age 16, as at registration) and gender. Empty
   optional fields clear the stored value. Email is shown read-only (changing it needs re-verification, M5b-2). Marketing
   consent is not edited here; it moves with the notification preferences (M8a).
8. **Account deletion and data export stay in M8b** and are a legal requirement on the launch checklist (HANDOFF section
   10, blocker 10). Admin TOTP moves to M9 (no roles exist before it).
9. **Times** are shown in Africa/Cairo with Western digits, formatted on the server and passed to client components as
   text, so server and browser can never disagree.

## Consequences

- Two small hooks in `src/server/auth/auth.ts` are now part of the auth contract; `auth.db` tests exercise them with the
  real Better Auth.
- A new migration (hand-written, `20261104000000_account_security`); the drift check is the owner's.
- Adding an event type later means `ALTER TYPE "SecurityEventType" ADD VALUE` in a migration.
- Device detection is deliberately coarse. A client with an unrecognised User-Agent has no label; iPad in desktop mode
  reads as macOS.
