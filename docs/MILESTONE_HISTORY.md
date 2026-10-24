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

## M2b verification record (moved from HANDOFF on 2026-10-21)

**Owner verified M2a locally (2026-10-19, Node 22.23.3):** `migrate dev` applied `20261014000000_catalog_inventory`; `migrate diff` printed "No difference detected" (exit 0); `test:db` 105 passed; tokens, contrast, brand, lint, typecheck and unit tests pass; CI on main (drift check + `test:db`) green. Known issue 21 is resolved.

**Verified in the sandbox (real execution):**

- Gates: `format:check`, `tokens:check`, `contrast` (60/60 AA), `brand:check` (181 files), `i18n:review:check` (491 strings), `seed:docs:check` (56 flagged products), `lint`, `typecheck`, `next build`.
- **336 unit tests** (31 files), including 28 new seed tests: data validity and volumes, every top-level and leaf category populated, unique SKUs/slugs/keys, planted mistakes caught by the validator (duplicate SKU, unknown brand/category/tag, bad spec, bundle dearer than its parts, missing Arabic), the 27 governorates covered once, promo cases, deterministic well-formed SVG (no scripts, escaped text, labelled), and the guard refusing a Supabase URL before any file is written. Domain: `resolveSpecDefinitions`, numeric-string radiator lists, case fans excluded from build roles.
- **126 DB tests** (`npm run test:db`, real PostgreSQL 18.4, 21 new in `tests/db/seed.db.test.ts`): the seed run THREE times with a full-table snapshot (every row, id and timestamp) identical; a drifted price is repaired while stock, counters and the adjustment log are untouched; a deleted bundle composition is restored; only catalog tables are written (no users, orders, reviews, settings); every seeded bundle is compatible with **zero warnings and zero unknowns**, saves money (under 15%), is sellable, has a known margin, and the high-end bundle's availability equals its scarcest part; all components are active physical products; out-of-stock and low-stock states exist; the top 10 by views and by units sold have no ties.
- The seed ran end to end against a scratch database (79 products, 6 bundles, 53 categories, 123 spec definitions, 251 placeholder images, 1.1 MB), and I looked at rendered samples of the placeholders.
- No schema or migration change in M2b, so no drift check is needed this time.

**Not verified (the owner must run):** `npm run db:seed` against his own Postgres on Windows (twice, to see "already up to date"), `npm run test:db` locally, GitHub CI for this delivery, and above all **the specs themselves**: they come from my knowledge, 56 of 79 products carry doubts listed in docs/SEEDING.md, and no spec was checked against a manufacturer page (no internet access to those sites here). Prices are illustrative.

**Found and fixed by seeding:** case fans sat under the `cooler` build role (would have been read as coolers by the PC Builder); case radiator sizes needed a numeric list but spec lists are strings only (accepted as numeric strings, ADR 0015).

## M3a-1 verification record (2026-10-21)

**Verified in the sandbox (real execution, PostgreSQL 18.4, the full seed):**

- Gates all pass: `format:check`, `tokens:check`, `contrast`, `brand:check`, `i18n:review:check` (550 strings), `seed:docs:check`, `lint`, `typecheck`; **373 unit tests** (36 files) and **143 DB tests** (6 files, `npm run test:db`).

- Domain unit tests: URL grammar, normalization, SEO policy, pagination window, selection removal, savings, category tree, TTL cache, storage URL parity, demo flag. Bug found by them: a half-invalid range (`1e3..5`) was accepted as `..5`; now rejected.
- `tests/db/listing.db.test.ts` (17 tests): exactly 3 statements per request (no N+1); every seeded spec facet (checkbox/enum, range/number) and synthetic list and toggle specs match an independent TypeScript implementation; disjunctive facet counts; every sort paginates disjointly and completely; default sort puts out-of-stock last; draft/archived/deleted excluded; menu tree rules (Gift Cards hidden, emptied categories drop out). Bug found by them: grouping on a bind-parameter spec key failed (fixed with GROUP BY ordinal).
- Production build with no database (CI verify path) and with the seeded database; HTTP checks on the running build: canonical/hreflang/robots for clean, filtered, page 2 and junk-parameter URLs; zero-result state; sitemap lists 104 category URLs (52 paths x 2 locales); menu categories present.
- Structural axe-core (WCAG A/AA, best-practice, no color-contrast, no layout rules) in jsdom on 8 server-rendered pages (en/ar, clean, filtered, zero-result, bundles, page 2): see issue 41 for what that does NOT cover.
- Library facts checked against the docs bundled in `next@16.4.0` (re-checked behavior on 16.4.2 by running the build): `unstable_cache` is superseded by `use cache`; `revalidate` segment config is removed only with `cacheComponents`; not-found status during streaming.

**Not verified (the owner must run):** `npm run test:db` and `npm run db:seed` locally; the Playwright suite (`npm run test:e2e`: new `listing.spec.ts` and the extended viewport matrix were never executed); a visual pass in a real browser (LTR and RTL, 320px to ultrawide, dark and light), including color contrast of the new pages; CI.

**Exact commands:** `npm ci`, `npm run db:seed` (needs the migrated DB), `npm run dev`, then open `/en/c/components/cpus`, `/ar/c/pc-bundles`, `/en/c/components?page=2`.

## M3a-1 follow-up (2026-10-22)

The owner ran e2e on a production build: 199 passed, 36 failed, 1 skipped. Fixes, all UNRUN by me in a browser:

1. **Target size (32 tests, `responsive.spec.ts`, mouse viewports, listing pages):** the 20x20 filter checkboxes. The spec requires 44x44 on the interactive element itself. Fix (UI, not the test): the real `<input>` now covers the whole row (`absolute inset-0`, invisible), so the control is the full-width 44px-high hit area and the label text is part of it; the visible box is drawn beside it and shows focus and checked state via `peer-*` classes. Native keyboard and screen-reader semantics are unchanged.
2. **`shell.spec.ts` mega-menu test:** locators scoped to the "Product categories" navigation (after navigating, "NVIDIA GeForce" is also a subcategory chip).
3. **`shell.spec.ts` sitemap:** no longer forbids `/c/`; asserts clean category paths in both locales, no query strings, no `/p/`, no Gift Cards, and the placeholder routes still absent.
4. **`shell.spec.ts` noindex:** uses real placeholders (`/en/cart`, `/en/p/anything`) and asserts that a clean category page has no robots meta while a filtered one is noindex.
5. **Unknown category:** now a real 404 (and `?page=50`, `gift-cards`); server HTML has exactly one robots tag; see issue 37 for what is not verified.

Also: `listing.spec.ts` and the viewport matrix are unchanged otherwise; `next` and `eslint-config-next` are 16.4.2.

**Verified here:** HTTP status 404 for six unknown/inactive/out-of-range URLs and 200 for clean and zero-result URLs (production build, seeded DB); exactly one robots tag in the server HTML of `/en/c/nope` and `/en/does-not-exist`; typecheck, lint, format, unit and DB tests, i18n review check. **Not verified (owner runs `npm run test:e2e` on a production build):** that the 32 target-size failures are gone (layout is not measurable without a browser; by construction the input rect equals the label row, at least 44px high and the full row wide), the focus ring on the new checkbox, dark/light look of the checked state, and the post-hydration robots-tag count.

## M3b verification record (2026-10-24; moved from HANDOFF)

**Verified in the sandbox (real execution; PostgreSQL 18.4 with the full seed; real Chromium 153 on a production build, 1 worker):**

- Gates: `format:check`, `tokens:check`, `contrast` (60/60), `brand:check`, `i18n:review:check` (638 strings), `seed:docs:check`, `lint`, `typecheck`; **411 unit tests** (43 files), **152 DB tests** (7 files); production build with the seeded DB AND with no database (`SKIP_ENV_VALIDATION=1`, the CI verify path).
- **e2e: 303 of 303 passed, 0 skipped** (smoke, console, shell, i18n-theme, listing, product, axe x 2 locales x 2 themes, responsive 10 viewports x 2 locales, now including `/p/` part and bundle pages). The previously skipped "mobile: Filters drawer" test runs and passes.
- New tests: video embed allow-list (hostile URLs), spec rows, build summary, purchase limits, JSON-LD (script-safe), last-good cache, sitemap service and route function (database failure gives 200 minimal or last good), compatibility message/placeholder parity per locale, product e2e (17), and DB tests: every seeded product and bundle page loads; every seeded bundle is verified compatible with quote = view price; statement count independent of part count; archived or out-of-stock part makes the bundle unavailable and flags exactly that part; draft/archived/deleted/inactive-brand/inactive-category products are 404 and out of the sitemap.
- Bugs the real browser found: focus did not return to "Enlarge image" after closing the viewer (fixed: real `Dialog.Trigger`).
- Housekeeping: sitemap degrades safely; the mobile Filters test was skipped because the config has one desktop project, so `isMobile` was never true (it now makes its own phone context); helpers wait for React hydration (`whenHydrated`); `npm run test:e2e` runs `scripts/e2e-preflight.mjs` (fails fast if the port is busy), `reuseExistingServer` only with `E2E_REUSE_SERVER=1`, local workers default 2 (4 with `E2E_PROD`, override `PW_WORKERS`); Dependabot cooldown 3 days (7 for majors).

**Not verified (the owner must run / look at):** a visual pass in real browsers and on real devices (LTR and RTL, dark and light) of the gallery viewer, the bundle table on a phone and the showcase layout; the Playwright run in the owner's environment (Windows, bundled Chromium); whether two canonical links appear after client-side navigation in a real browser (issue 43); that the seeded YouTube id plays (issue 34); Arabic copy (docs/I18N_REVIEW.md); CI on GitHub.

**Exact commands:** `npm ci`, `npm run db:seed` (idempotent), `npm run dev`, then open `/en/p/nvidia-geforce-rtx-5080-founders-edition-16gb`, `/ar/p/budget-gaming-pc-ryzen-5-5600-rtx-4060`, `/sitemap.xml`. Gates: `npm run lint && npm run typecheck && npm test && npm run test:db`; e2e on a production build: `npm run build && E2E_PROD=1 npm run test:e2e` (PowerShell: `$env:E2E_PROD=1; npm run test:e2e`; stop anything on port 3000 first, or `PORT=3100`).
