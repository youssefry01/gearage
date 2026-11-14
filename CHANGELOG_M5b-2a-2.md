# M5b-2a-2 changelog (follow-up: two e2e fixes, the undo for an email change, a harder cancel)

No new dependencies; `package.json` and the lockfile are unchanged (better-auth 1.7.17, next and eslint-config-next 16.4.5).

- **E2E fix 1 (issue 107).** Root cause was in the TEST, not the action: `sessions-notice` is an always-present polite
  live region (an empty 1 px sr-only box), which Playwright counts as visible, so `toBeVisible()` passed before the action
  had answered and the single `page.reload()` could render before the event commit. The action already awaits ONE
  transaction (sessions deleted plus the event). The test now waits for the notice TEXT; a structure test forbids the
  `toBeVisible()` pattern on that element. Proof: with a temporary 1.5 s delay in the action the old test fails exactly
  as on your machine and the new one passes.
- **E2E fix 2 (issue 108).** The warm-up now also signs out, signs in with an unknown address (dummy-hash path) and signs in
  for real, and loads the profile and security pages.
- **Undo an email change** (ADR 0027): 7-day single-use link in the notice to the old address; the old address is reserved;
  restores it, signs out every device, disables the password (reset required), logs it, tells both addresses, emails a reset
  link. Public page `/email-change/revert`. One hand-written migration `20261110000000_email_change_revert`.
- **Cancel is harder:** it signs out every session and emails a reset link.
- Three new emails or variants (EN and AR): `email-changed` (undo link), `email-reverted`, `email-revert-released`.
- Tests: 16 DB (432 total), 6 unit, 2 structure, 1 new e2e plus the cancel e2e extended; the revert page is in the axe and responsive matrices.
- Docs: ADR 0027, AUTH_MANUAL_TESTS section 17 (and section 16 step 2 updated), HANDOFF.

**Run the drift check for the new migration:** `npx prisma migrate dev`, then
`npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code` (expect 0).
