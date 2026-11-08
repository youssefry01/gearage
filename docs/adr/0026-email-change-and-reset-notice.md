# ADR 0026: Email change with re-verification, the reset notice, and session announcements (M5b-2a)

Status: accepted for review (owner decisions of 2026-11-05; the choices in "Open for the owner" need a yes).
Related: [0002](0002-auth-better-auth.md), [0003](0003-password-hashing.md), [0021](0021-rate-limiting.md),
[0022](0022-email-and-outbox.md), [0024](0024-auth-flows-and-lockout.md), [0025](0025-account-security-sessions-and-activity.md).

## Context

The email address is the account's recovery channel: whoever controls it can reset the password. Changing it is
therefore the most security-sensitive account change after the password itself. An attacker who steals a session should
not be able to move the account to an address they control, and the legitimate owner should be able to notice and stop
an attempt. The address book (the other half of the original M5b-2) is a separate milestone, M5b-2b, with its own
migration; see HANDOFF section 6.

## Decisions

1. **Our own flow, not Better Auth's.** Better Auth 1.7.15 (checked in `node_modules`) has an email-OTP email-change
   endpoint pair (`requestEmailChangeEmailOTP`, `changeEmailEmailOTP`). It needs the request headers (ADR 0025 keeps
   them away from Better Auth), asks for no password, sends nothing to the old address, deletes no sessions, writes no
   event and answers differently (and at a different speed) for a taken address. The flow below needs all of those, in
   one transaction, so it is ours; Better Auth stays the owner of passwords, sessions and tokens.
2. **The current password starts it.** A stolen session alone cannot begin a change. Every attempt, right or wrong,
   counts against `auth.email.change.user` (6 per 15 minutes per account, fail closed), because the form is a password
   oracle exactly like "change password".
3. **A 6-digit code goes to the NEW address.** CSPRNG (`randomInt`), zero-padded, valid for 30 minutes
   (`EMAIL_CHANGE_MINUTES`), 5 wrong tries (`EMAIL_CHANGE_MAX_ATTEMPTS`, counted atomically with one `UPDATE ... RETURNING`),
   after which the request is destroyed. Stored only as `HMAC-SHA256(key derived from the server secret and the account,
newEmail + code)`, so a database leak alone cannot replay it, and the code cannot be used for another address.
   One pending request per account (unique `userId`); starting again replaces it.
4. **The CURRENT address is told, with a way to cancel.** Immediately, in the account's page language: the new address
   in masked form (`j***@example.com`), the coarse device label, and a button that cancels the request. The cancel
   token is 32 random bytes (43 base64url characters), stored only as an HMAC, and travels in the URL **fragment**
   (never in a server log or a Referer header), like the reset token. Opening the link does nothing; a POST from the
   button cancels (a mail scanner that fetches links cannot cancel). The page is public on purpose (the person
   reading that mailbox may be on another device) and has its own per-IP policy (`auth.email.change.cancel.ip`, 10 per
   15 minutes, fail closed). Cancelling does not sign anything out; the page tells the person that if they did not ask,
   someone may know their password, and links to the password reset (which signs every device out).
5. **No enumeration of the new address.** A taken address (verified or not) and a free one take the same path: the same
   request row (with a code that is never delivered in the taken case, so no code can ever match), the same notice to
   the old address, the same answer ("code sent", and the page says "if this address can be used, we've sent a code"),
   the same limits (the per-target limit `auth.email.change.send.target`, 3 per hour, counts the address whether or not
   it has an account), and the lookup-plus-write block runs under `ENUMERATION_FLOOR_MS`. The owner of a taken address
   gets an "already has an account" email (`email-change-taken`) instead of a code: an inbox's owner is entitled to
   know that an account exists on it (same rule as `account-exists` at registration), and a person who tries one of their
   own addresses is told why no code came. A DB test compares the footprint of the two cases.
6. **Confirming is one transaction:** consume the request (a double submit changes nothing twice), move the address
   (`emailVerified` stays true: the person just proved the inbox), delete every OTHER session, delete every
   password-reset token issued to the account (a link sitting in the OLD mailbox must stop working), write the
   `EMAIL_CHANGED` event, and queue the `email-changed` notice to the OLD address. If someone took the address while the
   code was in the mail, the unique index refuses, nothing changes and the person is told it can no longer be used
   (they hold the code, so they control that inbox).
7. **Events.** `EMAIL_CHANGE_REQUESTED`, `EMAIL_CHANGE_CANCELLED` (by the person or by the link), `EMAIL_CHANGED`: type and
   time only, shown in the activity list, 12-month retention (ADR 0025). Nothing logs an address, a code or a token.
8. **Pending requests are pruned** by the daily `prune-auth-data` job (rows past their expiry); `ON DELETE CASCADE` removes
   them with the account. Database CHECKs: both secrets are 64 hex characters (a plain code or token cannot be stored),
   the address is stored normalized, the counter is not negative.
9. **Session sign-out announces its result.** `revokeSession` now answers `{ count }` (1 when this call signed the device
   out, 0 when it was already gone). This narrows ADR 0025 item 6 ("identical answer"): a session id of another account
   still answers 0, exactly like an id that never existed, so it says nothing about other accounts. The Security page
   keeps one always-present polite live region ("Signed out of 2 devices.", "No other devices were signed in.") and
   moves focus to the list, because the pressed button may be gone. There is still no confirmation step (owner, 2026-11-05).
10. **A reset by email now sends the same notice** as a signed-in change (owner, 2026-11-05): the `password-changed`
    template with `method: "reset"` ("every device was signed out", "someone may have access to your inbox"), in the language
    of the reset page, with the device that completed the reset. The event is logged as before. Best effort after the
    fact: a queueing failure never fails a reset that already succeeded. `method` is optional so rows queued earlier
    still render.
11. **Marketing email rule (owner, 2026-11-05).** `EMAIL_CATEGORIES` classifies every template; a test fails if one is
    "marketing". No marketing email before marketing consent can be edited (M8a), and every marketing email needs an
    unsubscribe link.

## Consequences and limits (honest list)

- **No revert after completion.** If an attacker holding a session, the password AND a new inbox finishes before the
  owner reads the notice, the old address is told ("changed", with a contact link) but cannot undo it. Recovery is by
  support; the Contact page is a placeholder until M12, so a working contact path is a launch blocker (HANDOFF section 10).
  A "revert within N days" link was considered and left out (it is a second recovery channel to secure).
- A squatter can register an address (unverified accounts are pruned after 7 days) and so make a legitimate move to it
  silently fail; the legitimate owner gets the "taken" email. Accepted.
- Each request emails two people; the per-account (5/hour) and per-target (3/hour) limits bound it. Brevo's free tier
  (about 300 a day) bounds it further.
- The code step shows the masked pending address to the signed-in owner (and the same for a taken address).

## Open for the owner

(a) the notice shows the new address masked, not whole; (b) the extra `email-changed` notice to the old address after
completion; (c) a taken address's owner is emailed; (d) the 30-minute lifetime; (e) cancelling does not sign sessions
out; (f) the per-device sign-out answer carries a count.
