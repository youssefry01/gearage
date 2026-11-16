# M5b-2b changelog (account area UX rework, plus the sign-out test race and a harder cancel)

No new dependencies and **no schema change, no migration**: `package.json` and the lockfile are unchanged (better-auth 1.7.17,
next and eslint-config-next 16.4.5). No drift check is needed this time.

- **Sign-out race in the e2e specs (issue 114).** Your diagnosis was right: a click on Sign out followed at once by `page.goto`
  cancels the in-flight Server Action. New helper `signOut(page)` (tests/e2e/helpers.ts) waits for hydration, clicks, waits for the
  home URL and for the session cookie to be gone. All 8 call sites in `auth.spec.ts` and the one in `global-setup.ts` use it. I
  scanned every spec for a click followed within two lines by `page.goto`: no other case.
- **Cancel disables the password** (your decision 1; ADR 0027 updated): the stored hash is replaced by a hash of random bytes, as in
  an undo, in the same transaction that deletes every session and the reset tokens; the reset email follows. Two DB tests (old
  password refused; a new one chosen through the emailed link works) and the e2e cancel test updated, cancel-page advice reworded (EN, AR).
  7 days stays as the named constant `EMAIL_REVERT_DAYS`; the automatic reset email stays.
- **Header account menu** (ADR 0028). Signed in: your initial in an orange circle (plus "Hello, <name>" from 1280px), a panel with My
  account, Profile, Security, Sign out. Signed out: a panel with Sign in and Create account. Same disclosure pattern as the mega-menu (button
  with `aria-expanded`, panel of plain links, Escape returns focus, click outside, focus out and navigation close it), click or key only.
  The panel is kept inside the viewport at every width in LTR and RTL. The existing header icons are unchanged.
- **How the header knows who is signed in:** `GET /api/account/state` (first name and initial only; private, no-store; per-IP limit that fails
  open; a request with no session cookie is answered without the database). The pages stay static and cacheable. Until it answers, the header is
  the plain link to /account it was before.
- **Account shell:** a column beside the content from 1024px with Sign out at its foot; a wrapping row of 44px links above the content on
  phones with Sign out last. One `<nav>`, one DOM order.
- **Pages:** Overview is a short summary (hello, "Signed in as <email>" once, device count, links). Profile is one form with one Save (email
  read-only with a link to Security). Security holds Password, Email (with **Change email address**, opening `/account/email`, which is
  highlighted under Security and has a back link), Where you're signed in, Recent security activity.
- Tests: new `tests/e2e/account-menu.spec.ts` (behaviour 7; panel inside the viewport at all 10 viewports x EN/AR x signed in/out = 40; axe with the
  menu open, 2 locales x 2 themes x 2 widths x 2 states = 8; shell at 320 and 1280 in both languages); unit tests for the state domain,
  the cookie check and the store; DB tests for the cancel. `docs/AUTH_MANUAL_TESTS.md` section 18 (and sections 10 and 16 updated).
- Docs: ADR 0028, ADR 0027 "Decided", HANDOFF (status, issues 114 to 118, owner question 23, section 11g), `docs/I18N_REVIEW.md` regenerated.
- Found by axe while testing and fixed: Sign out sat partly under the sticky header at some scroll positions on the Security page, so from 1024px the side menu now stays below the header while the page scrolls.

## Verified in the sandbox vs what you must run

- Sandbox (Node v22.23.4, embedded Postgres, headless Chromium, production build): lint, typecheck, Prettier; 811 unit tests; 433 DB tests; build with no env vars; the new account-menu spec; auth, account, email-change, shell, console and smoke specs; a11y and responsive specs for all pages except catalog, product, search, compare, styleguide and cart (298 passed).
- NOT verified: the full 894-test e2e run, Windows CI, the web-design-guidelines audit, real Brevo email, real devices.
- Run: `npm ci`, `npm run lint && npm run typecheck && npm test`, `npm run test:db`, build with DATABASE_URL unset, `npm run test:e2e`, then `docs/AUTH_MANUAL_TESTS.md` section 18. No migration this time.
