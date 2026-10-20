# Milestone history

Records moved out of HANDOFF.md to keep it short for resuming. Newest first is NOT guaranteed; each section names its milestone.
The current status, conventions, known issues and decisions are in [HANDOFF.md](../HANDOFF.md).

## M2a verification record (2026-10-15)

**Verified in the sandbox (real execution, not just written):**

- All CI gates: `format:check`, `tokens:check`, `contrast` (60/60 AA), `brand:check` (152 files; a planted violation fails), `i18n:review:check` (140 strings), `lint`, `typecheck`, prod `npm audit` = 0, `prisma validate` and `generate`, `next build` (139 static pages). `prisma migrate diff --help` confirmed the exact flags used in the docs and CI.
- **302 unit tests** (30 files): every domain module (money incl. a 2,000-trial allocation property test, pricing, stock, catalog, specs, compatibility incl. each rule failing alone and PSU boundaries), the test-database resolver, storage (traversal, content sniffing, SVG, size, atomic writes), sitemap rules, settings (top bar), status, consent, i18n parity.
- **105 DB tests** (`npm run test:db`) on a REAL PostgreSQL 18.4 (an npm-packaged binary): the whole hand-written migration executed; every CHECK, trigger, partial unique index and FK rule attacked (50); `product_availability` and `product_pricing` against their TypeScript twins on randomized data, plus the availability view under five session time zones (16); the stock service and **real concurrency** (50 COD buyers for 20 units, 40 reservations for 10, mixed races, opposite-order checkouts with no deadlock, bundles racing parts, 10 simultaneous payment confirmations decrementing once, conversion racing buyers) repeated three times with no flake (27); bundle detail, storefront listing in ONE statement (12). A Prisma Client round trip of all 13 models validates `schema.prisma` against the SQL.
- The DB suite also passes with BOTH Node and the database session set to UTC, Africa/Cairo, America/Los_Angeles and Pacific/Kiritimati (+14).
- **`test:db` never touches a development database**: run with only `DATABASE_URL` pointing at a dev database that held rows in a table named `product`, it derived the test database, passed, and the dev rows were intact. A remote host, a database not ending in `_test`, the dev database itself, and a host alias of it (`localhost` vs `127.0.0.1`) were all refused.
- **154 Playwright tests pass** in real Chromium on a production build (run as four groups because the authoring sandbox restarted during long runs): 80 viewport tests (10 viewports x en/ar x home/styleguide/cart/category, phones as touch contexts), 26 axe WCAG 2.2 AA runs, the shell spec (now including sitemap, robots and noindex), locale/theme/SEO/fonts, console cleanliness.

**Not verified (the owner must run):**

1. `npx prisma migrate dev` and `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code` (the Prisma engine is blocked in the sandbox). CI runs the same diff on every push. See known issue 21.
2. `npm run test:db` on the owner's own PostgreSQL version and Windows (the sandbox used 18.4 on Linux; CI uses 17).
3. GitHub CI for this delivery, real devices, Firefox/Safari.

**Found and fixed by this milestone's checks:** the availability view compared a UTC `timestamp` with `now()`, which breaks in a Cairo-time database session (live reservations would count as expired: overselling); a `localhost` vs `127.0.0.1` gap in the "never the dev database" rule; a CHECK that depended on `DEFAULT CURRENT_TIMESTAMP` (removed); the brand check caught the project name inside the test database name (now `brand.slug`).

## M1b verification record (2026-10-12)

Verified in the sandbox: `format:check`, `tokens:check`, `contrast` (60/60 AA with `#FF5A00`), `brand:check`, `lint`, `typecheck`, `vitest` (158 tests: status domain and service incl. TTL/single-flight/timeout, consent,
cart store, category tree integrity, route registry, ICU-aware message parity incl. Arabic plurals, logo, settings), prod `npm audit` = 0, `next build` (137 static pages).
**Playwright (real Chromium 153, 151 tests) all pass** on a production build: 80 viewport tests (10 viewports x en/ar x home/styleguide/cart/category, phones as real touch contexts: no horizontal scroll, 44px targets, direction),
26 axe WCAG 2.2 AA runs (4 pages + mega-menu open + drawer open, each x en/ar x dark/light, plus the banner visible in en/ar), shell (mega-menu hover/keyboard/Escape/focus return, sticky header, search, cart badge with plural names in en/ar,
drawer focus trap + RTL side + navigation, landscape-phone non-sticky, cookie consent flows, status dot in all states and on failure, `/api/status` contract, a dead-link sweep of every header/menu/footer link), locale/theme/fonts/SEO, console cleanliness.
The same console and shell specs also pass against `next dev` (where React/Next emit their warnings).
Bugs found by the real-browser run and fixed in M1b: React 19 "script tag" console error on locale switch; saved theme lost on locale switch (React rebuilds `<html>` attributes); both logo artworks lazy in light theme (LCP warning);
logo link had NO accessible name in the light theme; Radix NavigationMenu `aria-hidden-focus` violation (replaced by a disclosure-navigation menu); two Tailwind `hidden` vs `inline-flex` conflicts (wishlist on phones, a top-bar item on tablets);
footer links narrower than 44px; Arabic copyright scrambled by bidi; `og:image`-style partial metadata is covered by `pageMetadata`. All screenshots (header + footer, both themes, EN/AR, phone/tablet/desktop, plus mega-menu, drawer, banner, sticky) were reviewed.
**Not verified (run locally):** real devices and foldables (the matrix is emulated), Firefox/Safari, GitHub CI for this delivery, a real database for the status dot and settings (the sandbox has none, so the dot correctly shows "Service disruption").

## M1a verification record (2026-10-11)

Verified in the sandbox: `format:check`, `tokens:check`, `contrast` (60/60 AA), `brand:check` (and it fails on a planted hardcoded name), `lint`, `typecheck`,
`vitest` (114 tests incl. i18n parity, brand/logo file dimensions, DB guard, settings fallbacks, WCAG gate negative test), `next build`
(`/en` and `/ar` are statically generated), prod `npm audit` = 0, `prisma validate/generate`, the DB guard against the real Prisma CLI (refuses a Supabase host via `DATABASE_URL`
or `DIRECT_URL`, allows `validate`).
**Playwright ran for real** against `next start` in Chromium 153: **62/62 pass** = 40 viewport tests (10 viewports x en/ar x home/styleguide: no horizontal scroll, 44px targets, lang/dir),
8 axe WCAG 2.2 AA runs (en/ar x dark/light x 2 pages), locale negotiation + cookie, language switcher, SEO/hreflang/OG, localized 404s, fonts (no Google requests), theme persistence + logo swap, system theme, skip link.
Screenshots were reviewed visually (en/ar, dark/light, 390px and 1280px). The e2e run found and fixed 4 bugs unit tests could not see (both logos visible at once; page `openGraph` wiping the layout's;
skip-link padding; missing og:image).
**Not verified (run locally):** `docker compose`/real Postgres (`prisma migrate dev`, drift check, `/api/health/ready` = 200), Husky hooks, GitHub CI, real mobile devices/foldables (the matrix is emulated), Firefox/Safari.
Sandbox technique: `playwright install` is blocked, so a Chromium from the npm package `@sparticuz/chromium` (kept OUTSIDE the repo) was used via `PW_CHROMIUM_PATH` / `PW_CHROMIUM_ARGS` (supported by `playwright.config.ts`).

## Decisions and notes from M0

- `getDb()` is a lazy singleton: creating the client at import time broke `next build` without a DB (found in sandbox build).
- UI copy uses sentence case (frontend-design skill) rather than the Title Case rule in web-design-guidelines; deliberate.
- M0 audit (web-design-guidelines) fixed: skip link, `translate="no"` on the brand name, hover states, `touch-action`, `text-balance`,
  typographic apostrophes. No fonts are loaded yet (system stack); real fonts, tokens and contrast script arrive in M1a.
- `src/generated/prisma` is git-ignored; `postinstall` runs `prisma generate`.
- Vercel cron: one daily job in `vercel.json`; sub-daily `tick` comes from `.github/workflows/cron-tick.yml`
  (needs repo secrets `APP_URL` and `CRON_SECRET`).

### M0 results reported by the owner (local, Node 22.12.0, own Postgres)

`npm run lint`, `typecheck` and `test` (21 tests) pass; `git check-ignore` confirms `.env` and `.env.production` are ignored;
`npm audit` (all deps) showed 5 high (known issue 3). **Not reported yet:** migration drift check, `/api/health/ready` = 200 with the DB up, Husky hook behavior.

## M0 verification record

Verified in sandbox: `npm install`, `npm audit --omit=dev` (0 vulnerabilities), `eslint` (0 warnings; deliberate violations of
domain/server/UI layering and `any` each fail), `tsc --noEmit`, `prettier --check`, `vitest` (21 tests), `next build`,
`prisma validate` and `prisma generate`, `next start` + curl: `/api/health` 200, `/api/health/ready` 503 without a DB,
cron endpoints 401 without/with wrong secret and 200 with it, boot fails with a readable error when env is missing.

**NOT verified (run locally):**

1. `docker compose up -d` then `npx prisma migrate dev`. The baseline SQL in `prisma/migrations/20261009000000_baseline/` is
   hand-written (no schema engine in sandbox). Confirm no drift:
   `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code` (exit 0 = identical).
2. `/api/health/ready` returns 200 with the DB up.
3. Husky hooks (`git init` first): a non-conventional commit message is rejected; staged files are linted and formatted.
4. `npx playwright install chromium && npm run test:e2e` (3 smoke tests).
5. CI on GitHub (workflow uses `actions/checkout@v7`, `actions/setup-node@v7`, verified via `git ls-remote`).

## M0 scope (DELIVERED; kept for reference)

1. Next.js (latest stable 16.x, pin exactly), React 19, TS strict (`noUncheckedIndexedAccess`), Tailwind v4.
2. ESLint flat config + layering rules (`no-restricted-imports` overrides), `no-explicit-any`, Prettier (+ Tailwind plugin).
3. Husky + lint-staged + commitlint (conventional). Vitest + RTL (jsdom), Playwright config + smoke test.
4. `src/lib`: Zod env (validated at boot via `instrumentation.ts`, `SKIP_ENV_VALIDATION` for CI build), errors, api-response, structured logger.
5. Prisma (latest stable; verify `prisma.config.ts` and adapter conventions in current docs): multi-file schema, baseline migration
   (`pg_trgm` extension + `StoreSetting`), db client singleton with pooled URL.
6. `/api/health` (liveness) and `/api/health/ready` (DB ping); `/api/cron/tick` and `/api/cron/daily` with constant-time `CRON_SECRET` check
   and a job registry (ADR 0007); `vercel.json` daily cron; `.github/workflows/cron-tick.yml`.
7. `docker-compose.yml` (Postgres 17 + healthcheck), `.env.example`, CI workflow (lint, typecheck, test, build, audit), Dependabot, LICENSE (MIT, change if desired).
8. Docs: ARCHITECTURE.md, SECURITY.md stub, README (setup), these ADRs. Minimal home page with text wordmark placeholder.
9. Verify in sandbox: install, lint (incl. a deliberate layering violation fails), typecheck, tests, build, `prisma validate` + `generate`,
   `prisma migrate diff --script` for baseline SQL, start server and curl `/api/health`.
   User must test locally: `docker compose up -d`, `npx prisma migrate dev`, `/api/health/ready`, husky hooks, Playwright smoke.
