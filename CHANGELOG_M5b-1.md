# M5b-1 changelog (account area, part 1)

- **New pages:** `/account` (overview), `/account/profile` (edit name, mobile, date of birth, gender; unsaved-changes warning), `/account/security` (change password, signed-in devices with per-device and "Sign out of other devices", recent security activity). All en/ar, RTL, dark and light.
- **Sessions:** a coarse device label (`chrome/windows`, shown as "Chrome on Windows") is stored per session; the raw User-Agent and IP are never stored (database CHECK). New `security_event` table, pruned after 365 days by the daily job.
- **Change password:** current password required, per-account rate limit, keeps this session, signs out the others, writes the event and sends a notice email, all in one transaction. New `password-changed` email template (en/ar).
- **Forms:** phone typing limit 17 and the message "Enter an Egyptian mobile number like 01012345678"; the password hint says "You can use any language" (ADR 0024 items 16-17). Shared phone and gender fields.
- **Migration (hand-written):** `20261104000000_account_security`. **Run the drift check** (see below).
- **Docs:** ADR 0025, ADR 0024 items 16-17, AUTH_MANUAL_TESTS sections 10-13, SECURITY.md, HANDOFF (sections 1, 6, 10, 11d, 16, issues 93-99).
- No new dependencies; versions and lockfile unchanged.

Run locally (Git Bash): `npm ci`, `npx prisma migrate dev`,
`npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code` (expect 0),
`npm run lint && npm run typecheck && npm test && npm run test:db`, `npm run build && E2E_PROD=1 npm run test:e2e`.
Manual steps: docs/AUTH_MANUAL_TESTS.md sections 10-13 (use two browsers).
