# M5a-3 changelog

- Fix: `getSession()` calls `headers()` before reading secrets; per-user pages are `force-dynamic`; build passes with no env; CI verify job restored (no env).
- Verify page: address in a signed HttpOnly cookie (ADR 0024 items 11-12); reworded no-enumeration copy with links.
- UX: code field (numeric, one-time-code, paste cleaning, auto-submit), phone field, global cursor rules, hover/focus audit test.
- E2E: global warm-up and signed-in session for matrices; new auth specs.
- CI: `unit-windows` job. Docs: ADR 0024, AUTH_MANUAL_TESTS, HANDOFF (sections 1, 11c, issues 87-92).

Run locally: `npm ci`, `npm run lint && npm run typecheck && npm test && npm run test:db`, `npm run build && E2E_PROD=1 npm run test:e2e`.
No migration. Windows PowerShell: `$env:E2E_PROD=1; npm run test:e2e`.
