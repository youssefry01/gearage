# ADR 0027: The way back after an email change, and a harder cancel (M5b-2a follow-up)

Status: accepted for review (owner decisions of 2026-11-10; the choices in "Open for the owner" need a yes).
Related: [0022](0022-email-and-outbox.md), [0024](0024-auth-flows-and-lockout.md), [0026](0026-email-change-and-reset-notice.md).

## Context

ADR 0026 left a completed email change irreversible by the owner (HANDOFF issue 101, launch blocker 11). Anyone who
stole a session and knew the password could move the account to an address they control; the real owner was told, but
could only ask support. The owner asked for a time-limited undo, and for the cancel link to treat a started change as
a sign that the password is exposed.

## Decisions

1. **A revert row is written in the same transaction as the change** (`email_change_revert`): the old address, the new
   address, an HMAC of a single-use token (key "email-change-revert", different from the cancel token's), the
   expiry (`EMAIL_REVERT_DAYS` = 7) and the account. The link (`/email-change/revert#token=...`, fragment, POST only,
   public, same shape as the cancel page) is in the `email-changed` notice to the OLD address. The notice's new payload
   fields are optional, so a row queued earlier still renders.
2. **The old address is reserved for the window.** `oldEmail` is unique in the table. Every place that decides "is this
   address taken?" also asks the table: registration (same answer, same `account-exists` email, one password hash
   spent), an email-change request from ANOTHER account (the ordinary taken path: same row, same notice, same answer),
   and the confirming transaction (re-checked under the transaction; refused like a unique violation). An address reserved
   for the account itself is free for that account (it may take it back with the normal flow). The `user.email`
   unique constraint is unchanged. The window is enforced by `expiresAt > now` in the queries, not by the daily job.
3. **Pressing the button, in one transaction:** consume the token (one `DELETE ... RETURNING`, so two presses revert
   once), restore the old address (verified, because the link proved the inbox), delete EVERY session, delete reset
   tokens and the pending change, delete the account's other revert rows, replace the stored password hash with a hash
   of 32 random bytes (the old password stops working; a reset is required), log `EMAIL_CHANGE_REVERTED`, queue
   `email-reverted` to the restored address and `email-revert-released` to the address the account held at that moment.
   After the commit a reset link is emailed to the restored address through the ordinary Better Auth flow.
4. **Revert restores the address in the row whatever the account holds now.** After A to B to C, the link for A
   (sent to A) restores A and tells C; so a chain of changes by an attacker is undone by the first link.
5. **If another account holds the old address** (only possible by hand, since it is reserved) the transaction rolls back,
   the link stays as it was, and the answer is `address_unavailable`, which the page words as "contact support".
6. **After the window, recovery goes through support with identity checks.** Nothing in code; it is launch blocker 11.
7. **Cancel is stronger** (owner, 2026-11-10): the cancel link now deletes EVERY session of the account in the same
   transaction that removes the request, and a password-reset link is emailed to the account's address. The password is
   NOT disabled by a cancel (open choice 1 below).
8. **Retention:** a revert row holds two email addresses and an HMAC for at most 7 days; the daily job deletes
   expired rows and deleting the account cascades. Listed in the privacy-policy checklist.

## Consequences and limits

- One residual race: a registration that is already past its check at the instant a change commits can still take the freed
  address (the insert waits for the change to commit). It needs a sub-second coincidence; closing it needs a hook on user
  creation and is left out.
- The `account-exists` email sent to a reserved address says an account exists with that address. It is true of the
  address's owner, who is the person the email goes to; the account now signs in under a different address.
- The notice to the released address (possibly the attacker's inbox) says an address was removed from an account; it
  contains no link, address or code (a test pins this).
- Support must be able to act on the case "the revert window has passed" (blocker 11).

## Open for the owner

1. Should a cancel ALSO disable the password (as a revert does)? Whoever started the change knew it, so an attacker with the
   password can sign in again right after a cancel until the reset is done. Disabling is safer and costs the owner one
   reset; it is one line (`setCredentialHash`) in `cancelEmailChangeByToken` and one test.
2. Is 7 days right? It is one constant.
3. The reset link is emailed automatically after a revert or cancel. Say if you would rather show only the page text.
