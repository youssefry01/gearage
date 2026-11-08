# M5b-2a changelog (email change with re-verification, and the M5b-1 follow-ups)

M5b-2 was **split**: this delivery is M5b-2a; the address book is **M5b-2b** (next). Reasons: two independent features, each
with its own migration, drift check, tests and manual steps; a security change and a data feature are easier to review apart.

- **Email change** (`/account/email`, linked from Profile): current password required; a 6-digit code goes to the NEW address;
  the OLD address gets a notice with the masked new address, the device and a **Cancel** link; no way to tell from outside
  whether the new address already has an account (same row, same notice, same answer, same time; the owner of a taken
  address is emailed instead); confirming moves the address, signs out the other devices, deletes pending reset links,
  logs the event and tells the old address. Resend, "use a different address", expiry (30 min), 5 wrong tries.
  Public cancel page `/email-change/cancel` (token in the URL fragment, POST only). Six new rate-limit policies, all fail closed.
  Details and limits: [ADR 0026](docs/adr/0026-email-change-and-reset-notice.md).
- **Reset by email now sends the password-changed notice** too (same template, worded for a reset: every device was signed
  out); logged as before. The reset action takes the page language.
- **Sign-out announcements:** "Signed out of 2 devices." in an always-present polite live region; focus moves to the list.
  `revokeSession` returns `{ count }`. The devices list ("Signed in" with date and time in Cairo time, "Last active" as a date
  only) was already built this way; it is now pinned by a unit test and an e2e assertion.
- **Rules recorded:** no marketing email before M8a and an unsubscribe link on every one (`EMAIL_CATEGORIES` + a test);
  privacy-policy checklist (hashed IP addresses for rate limiting and more); **legal documents versioned and tracked**
  (requirement and proposed placement in HANDOFF section 15; nothing built).
- **New emails (EN + AR):** `email-change-code`, `email-change-notice`, `email-changed`, `email-change-taken`;
  `password-changed` gained an optional `method`.
- **Migration (hand-written):** `20261105000000_email_change` (3 event types, table `email_change_request`, CHECKs).
  **Run the drift check** (below).
- **Tests:** 23 new unit tests, 24 new DB tests (real PostgreSQL, Better Auth, Argon2), 5 new e2e tests, the new pages
  in the responsive/accessibility matrices (English/Arabic, dark/light, six viewports).
- **Docs:** ADR 0026, AUTH_MANUAL_TESTS sections 14-16, SECURITY.md, HANDOFF (sections 1, 6, 9, 10, 11e, 15, 16; issues 100-106).
- No new dependencies; versions and lockfile unchanged.

Run locally (Git Bash): `npm ci`, `npx prisma migrate dev`,
`npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code` (expect 0),
`npm run lint && npm run typecheck && npm test && npm run test:db`, `npm run build && E2E_PROD=1 npm run test:e2e`.
Manual steps: docs/AUTH_MANUAL_TESTS.md sections 14-16 (two browsers and two mailboxes).
