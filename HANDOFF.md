# Gearage — HANDOFF

> Resume rule: a new chat must be able to continue from this file alone. Update it every milestone.

## 1. Status (2026-10-12)

- Proposal **approved**. **M0** (foundations), **M1a** (tokens, light/dark, next-intl + RTL, fonts, brand config, logos) and **M1b** (shell: header, mega-menu, drawer, footer, status dot, cookie banner, `/api/status`) are **delivered**.
  Next: **M2a** (domain: money, pricing, promo, stock and bundle logic, as pure tested modules). Ask the owner before starting it.
- Owner verified M1a locally (Node 22.23.3): `brand:check`, lint, typecheck, 114 unit tests and 62 e2e pass; the DB guard refused a remote URL; `/api/health/ready` = 200; GitHub CI green.
- Pinned versions (ADR 0011): Next 16.4.0, React 19.3.0, TypeScript 6.0.3 (typescript-eslint caps below 6.1), Prisma 7.10.0
  (CLI `latest` tag is an 8.0 RC), Zod 4.6.5, ESLint 10.12.0, Vitest 5.0.3, Tailwind 4.3.3, next-intl 4.14.9, @fontsource/ibm-plex-sans(-arabic) 5.3.0,
  radix-ui 1.7.0, lucide-react 1.55.0, zustand 5.0.15.
- Node: `engines.node` = `>=22.22.2 <23`; the owner's `.nvmrc` is `22` (latest 22.x) and CI uses `node-version-file: .nvmrc`; `.npmrc` has `engine-strict=true`.
- Owner environment: Windows (Git Bash), Node 22.23.3, **local Postgres (no Docker)**, `.env` (local) and `.env.production` (future prod, local-only), both gitignored.
- Owner repo files to keep: `.gitattributes` (`* text=auto eol=lf`) and `desktop.ini` in `.gitignore`.

## 2. Product and brand

- Gearage: PC hardware store for Egypt. EGP as integer piastres. COD first-class. English + Arabic (RTL). **"Gearage" is a working name.**
- Brand colors (owner-confirmed 2026-10-12): orange **`#FF5A00`** (the exact logo value), dark surface `#0D1114`. Defined once in `src/design/tokens.ts` (`brandColors`).
- Contrast is **verified by script** (60 pairs, both themes, `npm run contrast`, CI gate): brand orange on white is 3.13:1 (fails AA text),
  dark ink on orange 6.06:1, `#C2410C` link on white 5.18:1. Bright orange = fills with dark labels; light-mode orange text uses `#C2410C`.
- Centralized branding: `src/config/brand.ts` plus `{brand}` and `{tagline}` placeholders in `messages/*.json` (resolved at load; see ADR 0012). Logos in `public/brand/`, rules in `docs/BRAND.md`.

## 3. Approved decisions

| Area               | Decision                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| App                | One Next.js (App Router, TS strict) modular monolith. No separate Node framework.                                                |
| DB                 | PostgreSQL; Prisma + `@prisma/adapter-pg`; pooled runtime URL, direct URL for migrations; raw SQL for views/FTS/partial indexes. |
| Auth               | Better Auth (Auth.js team joined Better Auth Sept 2025; Auth.js is security-patch-only). Wrapped behind our own `getSession()`.  |
| Hashing            | Argon2id via `@node-rs/argon2`, target m=64 MiB, t=3, p=1, pepper as Argon2 secret; benchmark to ~150-300 ms; rehash on login.   |
| Payments           | Paymob behind `PaymentProvider`; re-verify docs at M7. Live mode needs merchant onboarding + fees (only unavoidable paid item).  |
| Search             | Postgres FTS (`simple`) + `pg_trgm` on a normalized `search_document`; `SearchProvider` interface.                               |
| Specs              | JSONB + typed `SpecDefinition` per category (Zod generated from definitions).                                                    |
| Email              | Brevo + React Email, via `EmailOutbox` with retries.                                                                             |
| Rate limit         | Upstash free tier, Postgres fallback behind one interface.                                                                       |
| Slugs              | One Latin slug for both locales. Prices use Western digits (`ar-EG` + `latn`).                                                   |
| Buttons            | Orange fill + dark label.                                                                                                        |
| **Guest checkout** | **No.** Checkout requires a verified-email account. Guest _cart_ is allowed and merges on login.                                 |
| **Locale**         | **Accept-Language detection, fallback `en`, choice remembered in a cookie.** See ADR 0006.                                       |
| **Stock model**    | **COD decrements at order creation; online payment reserves with expiry then converts.** See ADR 0008.                           |
| **Milestones**     | **M2 split into M2a / M2b; other oversized milestones split too (§6).**                                                          |
| Hosting            | Vercel Hobby is non-commercial: fine for demo, Pro (or other host) needed for real sales.                                        |

## 4. Architecture and layering

```
route/page/action (thin) -> features/* -> server/services -> server/repositories (Prisma/SQL) -> DB
                                     \-> domain/* (pure TS, no I/O)
```

Lint-enforced: `domain/` imports nothing from app layers, `next`, `react`, or Prisma;
`server/` never imports `features/`, `components/` or `app/`; UI code never imports repositories/db.

```
gearage/
  .github/workflows/ (ci.yml, cron-tick.yml)  .husky/  commitlint  docker-compose.yml  vercel.json
  docs/ adr/ ARCHITECTURE.md SEEDING.md ASSETS.md SECURITY.md
  prisma/ schema/*.prisma  migrations/  sql/  seed/ (index.ts, data/*, placeholders/)
  messages/ en.json ar.json     public/brand/
  src/ app/[locale]/...  app/api/(health|webhooks|cron|og)  proxy.ts
       domain/   money pricing bundle promo compatibility order-state stock
       server/   services repositories db auth payments email storage search security jobs
       features/ catalog cart checkout account reviews admin/*
       components/ (ui, layout)   lib/ (env, errors, api-response, logger, i18n)
  tests/e2e/
```

## 5. Key models (details in ADRs)

- Money: `Int` piastres; SQL aggregates cast to bigint. Soft delete via `deletedAt` + partial unique indexes.
- Bundles: `Product.type = BUNDLE` + `BundleItem`; no stored stock; availability from SQL view `product_availability`;
  components physical only (no nesting); order snapshots in `OrderItemComponent`. ADR 0010.
- Stock and reservations: ADR 0008. Jobs and cron: ADR 0007.

## 6. Roadmap (revised)

Rule: every milestone is runnable, tested, ends with the web-design-guidelines audit, a cumulative zip and this file updated.

| #       | Milestone                                     | Notes                                                                                                                                                            |
| ------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0      | Foundations                                   | Scaffold, tooling, CI, Docker, Zod env, Prisma baseline, health, cron skeleton, ADRs, HANDOFF                                                                    |
| M1a     | Design tokens, themes, i18n/RTL, fonts        | **DELIVERED.** Contrast verified by script; brand config; logos; real-browser e2e matrix                                                                         |
| M1b     | Shell                                         | **DELIVERED.** Header (top bar, search, account/wishlist/cart badge, mega-menu, sticky), mobile drawer, footer + status dot, cookie banner, cached `/api/status` |
| **M2a** | Catalog schema, domain logic, services, tests | Money, pricing, stock/reservations, bundles, compatibility, storage interface                                                                                    |
| **M2b** | Seed, placeholders, docs                      | Idempotent seed, SVG placeholders, SEEDING.md, ASSETS.md, seeded-bundle compatibility test                                                                       |
| M3a     | Home, listings, filters                       | URL-synced filters, sorting, pagination                                                                                                                          |
| M3b     | Product + bundle pages                        | Gallery, showcase rendering, JSON-LD, sitemap                                                                                                                    |
| M4      | Search and discovery                          | FTS + trigram, suggestions, compare, recently viewed, view tracking                                                                                              |
| M5a     | Auth core                                     | Register, login, verify, OTP, reset, Argon2id, HIBP, rate limit, lockout, Brevo outbox                                                                           |
| M5b     | Account security                              | Sessions list, email change, profile, addresses, audit log, admin TOTP                                                                                           |
| M6a     | Cart, promo, shipping                         | Cart merge, promo engine, shipping zones/fees                                                                                                                    |
| M6b     | COD checkout and orders                       | Atomic order creation, state machine, confirmation email, order history                                                                                          |
| M7      | Online payments                               | Paymob, HMAC webhook, idempotency, payment state machine, reservation expiry                                                                                     |
| **M7b** | `/status` page (**APPROVED by owner**)        | Full localized page: website/API/DB/email/payments, coarse states, cached, rate-limited                                                                          |
| M8a     | Reviews, wishlist, notifications              |                                                                                                                                                                  |
| M8b     | Returns, refunds, invoices                    | HTML invoice, PDF spike, data export and deletion                                                                                                                |
| M9      | Admin I                                       | RBAC, orders management, inventory adjustments, overview                                                                                                         |
| M10a    | Admin catalog CRUD + uploads                  |                                                                                                                                                                  |
| M10b    | Showcase editor + bundle builder              | Live stock and margin preview                                                                                                                                    |
| M11     | Admin III                                     | Promos, shipping, customers, moderation, inbox, CSV, bulk edit                                                                                                   |
| M12     | Trust pages                                   | Legal drafts (flagged for review), FAQ, contact, branch locator                                                                                                  |
| M13a    | Hardening                                     | Sentry, CSP audit, Lighthouse, a11y (LTR + RTL), Playwright suites                                                                                               |
| M13b    | Release docs                                  | README, ERD, deploy guide                                                                                                                                        |
| M14+    | Optional                                      | PC Builder UI, bundle customize, installments, abandoned cart                                                                                                    |

Seed ships in **M2b**. Status: dot in M1b (website/API/DB via cached `/api/status`), full page M7b, because it needs the rate-limit layer (M5a), the email outbox (M5a) and a payments probe (M7).
M1b note: the shadcn CLI fetches from ui.shadcn.com, which may be blocked in the sandbox; if so, Radix-based components are written by hand in shadcn style (tokens already use shadcn names). Showcase: schema M2a, seed blocks M2b, rendering M3b, admin editing M10b.

## 7. Extras (approved)

Adopt: outbox + retries, idempotency keys, store settings (COD fee/max, free-shipping threshold, maintenance), price history,
SEO redirects, back-in-stock, newsletter (double opt-in), low-stock alerts, zero-result search analytics, admin TOTP,
WhatsApp button, PDPL tooling. Defer: abandoned cart, installments, product Q&A, gift cards, PC Builder UI.
Cut: Cloudinary provider, PWA, live chat, loyalty, multi-currency, multi-vendor.

## 8. M0 scope (DELIVERED; kept for reference)

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

## 9. Conventions

Conventional commits. No `any`. Zod at every boundary. Money only via `domain/money`. Authorization check in every mutation.
Errors via `AppError`; API format `{ ok, data | error:{code,message} }`. Detail goes in `docs/adr/`.

- **Never hardcode the store name**: use `src/config/brand.ts` (code) or `{brand}`/`{tagline}` (messages). `npm run brand:check` enforces it.
- **Never write hex colors** in components: semantic classes only. Add/change colors in `src/design/tokens.ts`, then `npm run tokens:build`; add a `CONTRAST_PAIRS` entry for every new usage.
- **i18n**: no hardcoded UI strings; every message exists in all locales with identical keys/placeholders (test-enforced). Use logical CSS (`ms-`, `ps-`, `start-`, `text-start`), never `left/right`. No letter-spacing on Arabic (the `tracking-display` token is 0 under `:lang(ar)`).
- **Metadata**: pages return `pageMetadata(locale, ...)` from `src/lib/seo.ts`. Never return a partial `openGraph` (Next replaces nested objects).
- **Responsive**: mobile-first; every page works at 320px; touch targets >= 44px (`min-h-11`); no horizontal page scroll. Add new pages to `PAGES` in `tests/e2e/viewports.ts`.
- **Tailwind class order**: Prettier's Tailwind plugin reorders class strings. When scripting edits, rewrite whole files instead of string-replacing class lists.
- **Never bake a display utility into a shared class string** (`inline-flex`, `flex`, `block`) that callers combine with `hidden`: the display utility wins in the generated CSS. This caused two real bugs in M1b (wishlist icon on phones, top-bar item on tablets). Put `inline-flex`/`hidden md:inline-flex` on the element itself.
- **Touch targets**: 44px on everything (`min-h-11 min-w-11`; short text links need `min-w-11` too). The ONE exception is the dense desktop top bar, 32px with a fine pointer, lifted to 44px by `pointer-coarse:`. The e2e matrix runs phones/tablets as real touch contexts (`isMobile + hasTouch`) so `(pointer: coarse)` is what is tested.
- **Theme**: `data-theme` is not a React prop on `<html>` and is not persistent DOM state (a locale switch remounts the layout and rebuilds `<html>`'s attributes). `ThemeScript` (server-rendered only, to avoid React 19's script-tag warning) covers first paint; `ThemeSync` re-applies the stored theme in a layout effect.
- **React lint**: `react-hooks/set-state-in-effect` is on. To reset state when a prop changes (e.g. close a menu on navigation), adjust state during render (`if (path !== last) { setLast(path); setOpen(false) }`), not in an effect.
- **E2E robustness**: a hover/click before hydration is lost. Use `openMegaMenu`/`openDrawer` from `tests/e2e/helpers.ts` (they retry until `aria-expanded`/dialog). Specs import `test`/`expect` from `./fixtures` (pre-sets the consent cookie so the banner does not cover pages; opt out with `test.use({ consent: false })`).
- **Links**: header, footer and menus link through `src/config/routes.ts` and `features/navigation/categories.ts`. Routes without a page yet are served by the "coming soon" catch-all (200, noindex); remove a key from `PLACEHOLDER_ROUTES` when its real page ships.
- **Server Actions** (from M5a): next-safe-action, confined and swappable per [ADR 0013](docs/adr/0013-server-side-structure.md). Services stay framework-free.
- **Unlayered CSS beats Tailwind utilities** (utilities live in a layer). Theme-swap rules (logo) are deliberately unlayered.

## 10. Known risks / open items

Vercel Hobby non-commercial; Supabase free pauses after inactivity, no PITR; Brevo free ~300 emails/day;
Egypt ETA e-invoicing is not covered by our PDF (legal review before launch); Arabic PDF shaping needs a spike (M8b);
placeholder SVGs bypass `next/image` optimization; Better Auth is newer than Auth.js (hence the wrapper).
Open bundle decisions (defaults chosen): parts-in-box; one promo code per order and bundles excluded from item-level % codes;
`soldViaBundles` counter, reviews not aggregated; bundles filter by price/availability/derived summary and compare bundle-vs-bundle only;
component-level returns refund allocated price; seed bundles use fixed price.

### Known issues (tracked)

1. **ESLint 10 peer warnings**: `eslint-config-next` 16.4.0 bundles `eslint-plugin-import` 2.32.0, `eslint-plugin-jsx-a11y` 6.10.2 and `eslint-plugin-react` whose peer ranges stop at ESLint 9 (`npm ls` shows `invalid`).
   Linting works (layering violations and `any` are still caught, verified). Revisit when those plugins widen their ranges; fallback is ESLint 9.
2. **Prisma overrides**: `package.json` `overrides` pin `mysql2` 3.24.5 and `deepmerge-ts` 8.0.2 to clear `npm audit` highs in the Prisma CLI tree (ADR 0011).
   **Revisit when Prisma patches its transitive deps** (and when Prisma 8 is stable); then delete the overrides and re-run `npm audit`.
3. **`npm audit` (all deps) reports 5 high via `braces`** (chain: eslint-config-next > @next/eslint-plugin-next > fast-glob 3.3.1 > micromatch > braces). Dev-tooling only, no patched `braces` exists, not shipped.
   The CI gate audits production deps only (`--omit=dev`, 0 findings). Revisit when `@next/eslint-plugin-next` updates fast-glob.
4. `metadataBase` build warning comes from the global `/_not-found` page (outside the locale layout); harmless. Set `APP_URL` in production.
5. `themeColor` follows the OS scheme, not the in-app theme toggle (meta tags are static). Acceptable; revisit if it matters.
6. Locale switch links drop the query string (`href={pathname}`). Fix in M3a when listing filters exist.
7. The Arabic language label ("العربية") on English pages makes the Arabic font (weight 500) download there too; negligible.
8. Fonts are not preloaded (fontsource CSS); measure CLS/LCP in the M13a Lighthouse pass.
9. `typedRoutes` is off (conflicts with locale-prefixed hrefs).
10. All Arabic copy (UI strings, tagline, SEO text, category names) is machine-written and **needs native review**: the full list (142 strings) is in section 17. Regenerate it with `npm run i18n:review`.
11. Strict CSP is not set yet (M13a). The theme init script is a constant, so allow it by SHA-256 hash.
12. (Resolved in M1b) The mega-menu panel is full-width: it is a disclosure-navigation menu anchored to the sticky header, replacing Radix NavigationMenu (which injected focusable `aria-hidden` proxies, an axe `aria-hidden-focus` violation).
13. The cart store is minimal (`lines: Record<productId, qty>`, persisted to localStorage). M6a replaces the line model (variants, bundle components, stock validation, guest-to-account merge) and keeps `useCartStore` / `selectCartCount`.
14. These pages are "coming soon" placeholders (200, noindex) until their milestone: search (M4), cart/checkout (M6), account/wishlist (M5/M8), compare, deals, legal/trust pages and branches (M12), `/status` (M7b), and every category page (M3a). The header search form already targets `/{locale}/search?q=`.
15. `/api/status` has no per-IP rate limit yet (the shared limiter arrives in M5a, applied in M7b). Until then load is bounded by three caches: one DB probe per 30s per instance, CDN `s-maxage=30`, browser `max-age=15`. It always returns 200 and only coarse states.
16. The locale layout uses ISR (`revalidate = 3600`), so edits to contact/social StoreSetting appear within an hour; admin saves will revalidate immediately in M11.
17. The category tree is static (`features/navigation/categories.ts`); M3a serves the same shape from the database and deletes the file.
18. The cookie banner's "Analytics" category has no consumer yet (Vercel Analytics or similar later). Consent is recorded in the first-party `consent` cookie (version, analytics flag, timestamp; about 6 months).
19. shadcn/ui is not installed through its CLI (its registry is blocked in the sandbox). Components are hand-written with Radix primitives in shadcn's style; token names already match shadcn's, so real shadcn components can be dropped in later.
20. Top-bar claims ("Cash on Delivery across Egypt", "Delivery to every governorate") must match the real shipping zones configured in M6a. Confirm coverage before launch.

## 11. M0 verification record

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

## 12. Decisions and notes from M0

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

## 13. M1a verification record (2026-10-11)

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

## 13b. M1b verification record (2026-10-12)

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

## 14. Environment strategy

Dot-folders and dotfiles in the repo: `.github/` (workflows `ci.yml`, `cron-tick.yml` (inactive), `dependabot.yml`), `.husky/` (`pre-commit`, `commit-msg`; `_` is generated and ignored);
files `.env.example`, `.gitattributes`, `.gitignore`, `.npmrc`, `.nvmrc`, `.prettierignore`, `.prettierrc.json`. Ignored/local: `.git/`, `.next/`, `.vercel/`, `.env`, `.env.production`.

- Local: `.env` (from `.env.example`) with a local Postgres. `.env.production` is a local-only convenience for production-like runs (`next build`/`start` load it); never commit it.
- Production/preview: variables set in Vercel (Production and Preview separately). Supabase `DATABASE_URL` = pooled (6543, `?pgbouncer=true`), `DIRECT_URL` = direct (5432). `CRON_SECRET` >= 32 chars. `APP_URL` = public URL. `ENABLE_STYLEGUIDE` stays `0`.
- Migrations: local `prisma migrate dev`; production **only** `prisma migrate deploy`. `prisma/guard.ts` refuses `migrate dev|reset`, `db push|seed|execute` and `studio` on any non-local host (no override).
- `.github/workflows/cron-tick.yml` is **inactive** (manual dispatch only). To activate after deployment: add repo secrets `APP_URL` and `CRON_SECRET`, uncomment the `schedule` block.

## 15. Requirements added after approval (2026-10-11), all tracked here

- **Brand and theming**: tokens as CSS variables only; light AND dark (dark brand-native); darker orange token for text on light; brand colors `#FF5A00`/`#0D1114`; favicon, OG image and email templates follow the palette (emails: M5a).
- **Centralized branding**: typed brand config, colors in tokens, contact/social in `StoreSetting`; never hardcode the name; CI check (done in M1a). Interpolate the name in messages, emails, legal pages, metadata, JSON-LD, OG images and invoices (use `brandVars`/`storeName`).
- **Bundle risks** (proposal items, tracked in ADR 0010 and the M2a checklist): refund/invoice allocation per component (snapshot allocated price, VAT, promo share, cost); aggregate component stock checks across cart lines with deterministic lock ordering; components are physical products only (no nesting), deletion restricted, bundle auto-unavailable if a component is archived; derived stock computed in SQL for listings (no N+1); fixed bundles first, customize later but order snapshots already store the actual chosen components; compatibility rules as a pure tested module, with a test that all seeded bundles pass it; open decisions listed in §10.
- **/status page**: public, localized, overall + website/API/database/email/payments, coarse states only (operational/degraded/down, no versions/hostnames/errors), cached and polled gently (no live DB/third-party call per visit), rate-limited, current status only, footer dot linking to it. Footer dot shipped in M1b (cached `/api/status`); the full page is **M7b, approved by the owner**.
- **Responsive**: mobile-first 320px to ultra-wide, no horizontal page scroll, 44px targets, fluid type/spacing, tables/mega-menu/galleries adapted per breakpoint; verified every milestone on the fixed matrix in `tests/e2e/viewports.ts` in LTR and RTL.

## 16. Owner decisions (2026-10-12) and open questions

Decided: brand orange is **`#FF5A00`** (done; all 60 contrast pairs still pass). Missing logo files (wordmark-only, SVG exports of inline/stacked) will be supplied by the owner later, not blocking.
The separate "main logo image" is not needed. The Arabic store name stays Latin ("Gearage") in both locales for now. The `/status` page is approved for M7b (footer dot in M1b, `/api/status` cached).
Server-side structure decided in [ADR 0013](docs/adr/0013-server-side-structure.md): next-safe-action for Server Actions (from M5a), plain Route Handlers for webhooks/cron/health/status, Hono deferred until a public API is needed.

Open for the owner:

1. **Touch-target refinement**: M1a said 44px everywhere. M1b keeps 44px on all touch screens and all controls, but lets the dense desktop top bar be 32px with a mouse (`pointer-coarse:` lifts it to 44px on touch). Approve, or require 44px in the top bar too (it would be a 44px-high strip).
2. **Header on phones**: the wishlist icon is hidden below 640px and lives in the drawer (to keep logo + account + cart + menu from overflowing a 320px screen). OK?
3. **Placeholder pages**: unbuilt routes return a localized "coming soon" page (200, noindex) instead of a 404, so no header or footer link is ever dead. OK to keep until each milestone?
4. **Delivery claims** in the top bar (see known issue 20).
5. Native Arabic review (section 17).

## 17. Needs native review: machine-written Arabic

142 Arabic strings need native review. Every string below was written by the assistant, not a native copywriter. Review tone, terminology (Egyptian retail wording, e.g. category names) and plural forms.
Brand and model names left in Latin (AMD Ryzen, DDR5, ...) are not listed. Regenerate this list with `npm run i18n:review` after adding strings.

<!-- prettier-ignore-start -->
### UI messages
 | Where | English | Arabic (machine-written) |
| --- | --- | --- |
| messages: Common.skipToContent | Skip to main content | انتقل إلى المحتوى الرئيسي |
| messages: Common.language | Language | اللغة |
| messages: Common.theme | Theme | المظهر |
| messages: Common.themeLight | Light | فاتح |
| messages: Common.themeDark | Dark | داكن |
| messages: Common.themeSystem | System | حسب النظام |
| messages: Common.backToHome | Back to home | العودة إلى الرئيسية |
| messages: Common.tryAgain | Try again | حاول مرة أخرى |
| messages: Home.lead | {tagline} | {tagline} |
| messages: Home.status | {brand} is under construction. The catalog and checkout are coming soon. | {brand} قيد الإنشاء. الكتالوج والدفع قادمان قريبًا. |
| messages: NotFound.title | Page not found | الصفحة غير موجودة |
| messages: NotFound.body | That page doesn’t exist or has moved. | هذه الصفحة غير موجودة أو تم نقلها. |
| messages: Error.title | Something went wrong | حدث خطأ ما |
| messages: Error.body | The page failed to load. Try again, and contact us if it keeps happening. | تعذّر تحميل الصفحة. حاول مرة أخرى، وتواصل معنا إذا استمرت المشكلة. |
| messages: Styleguide.title | Style guide | دليل الأسلوب |
| messages: Styleguide.intro | Development reference for the {brand} design system. Not indexed and hidden in production. | مرجع التطوير لنظام تصميم {brand}. غير مفهرس ومخفي في الإنتاج. |
| messages: Styleguide.colors | Color tokens | ألوان التصميم |
| messages: Styleguide.type | Type | الخطوط |
| messages: Styleguide.typeSample | Graphics cards, memory and storage | كروت الشاشة والذاكرة والتخزين |
| messages: Styleguide.controls | Controls | عناصر التحكم |
| messages: Styleguide.primaryAction | Add to cart | أضف إلى السلة |
| messages: Styleguide.secondaryAction | Compare | قارن |
| messages: Styleguide.link | Read the delivery policy | اقرأ سياسة التوصيل |
| messages: Styleguide.fieldLabel | Email address | البريد الإلكتروني |
| messages: Styleguide.fieldHint | We only use it for order updates. | نستخدمه فقط لتحديثات الطلب. |
| messages: Nav.menu | Menu | القائمة |
| messages: Nav.closeMenu | Close menu | إغلاق القائمة |
| messages: Nav.categories | Product categories | فئات المنتجات |
| messages: Nav.mobileTitle | Browse the store | تصفح المتجر |
| messages: Nav.mobileDescription | Browse all product categories and manage your preferences. | تصفح جميع فئات المنتجات وأدر تفضيلاتك. |
| messages: Nav.shopAll | Shop all {name} | عرض كل {name} |
| messages: Nav.deals | Deals | العروض |
| messages: Nav.searchLabel | Search the store | ابحث في المتجر |
| messages: Nav.searchPlaceholder | Search CPUs, GPUs, SSDs… | ابحث عن معالجات، كروت شاشة، SSD… |
| messages: Nav.searchSubmit | Search | بحث |
| messages: Nav.account | Account | الحساب |
| messages: Nav.signIn | Sign in | تسجيل الدخول |
| messages: Nav.wishlist | Wishlist | المفضلة |
| messages: Nav.cart | Cart | السلة |
| messages: Nav.cartCount | {count, plural, =0 {Cart, empty} one {Cart, # item} other {Cart, # items}} | {count, plural, =0 {السلة فارغة} one {السلة، منتج واحد} two {السلة، منتجان} few {السلة، # منتجات} many {السلة، # منتجًا} other {السلة، # منتج}} |
| messages: Nav.support | Help & support | المساعدة والدعم |
| messages: Nav.codInfo | Cash on Delivery across Egypt | الدفع عند الاستلام في جميع أنحاء مصر |
| messages: Nav.deliveryInfo | Delivery to every governorate | توصيل إلى كل المحافظات |
| messages: Nav.callUs | Call us | اتصل بنا |
| messages: Nav.utility | Account and help | الحساب والمساعدة |
| messages: Nav.preferences | Preferences | التفضيلات |
| messages: Routes.search | Search | البحث |
| messages: Routes.cart | Cart | السلة |
| messages: Routes.wishlist | Wishlist | المفضلة |
| messages: Routes.account | My account | حسابي |
| messages: Routes.compare | Compare | المقارنة |
| messages: Routes.deals | Deals | العروض |
| messages: Routes.contact | Contact us | اتصل بنا |
| messages: Routes.about | About us | من نحن |
| messages: Routes.faq | FAQ | الأسئلة الشائعة |
| messages: Routes.shipping | Shipping and delivery | الشحن والتوصيل |
| messages: Routes.returns | Returns and refunds | الإرجاع والاسترداد |
| messages: Routes.warranty | Warranty | الضمان |
| messages: Routes.terms | Terms and conditions | الشروط والأحكام |
| messages: Routes.privacy | Privacy policy | سياسة الخصوصية |
| messages: Routes.cookies | Cookie policy | سياسة ملفات الارتباط |
| messages: Routes.branches | Branches | الفروع |
| messages: Routes.status | System status | حالة النظام |
| messages: ComingSoon.body | This page is coming soon. We’re still getting it ready. | هذه الصفحة قادمة قريبًا. ما زلنا نجهزها. |
| messages: ComingSoon.categoryBody | We’re stocking this category. Check back soon. | نجهز منتجات هذه الفئة. عد قريبًا. |
| messages: Breadcrumb.label | Breadcrumb | مسار التنقل |
| messages: Breadcrumb.home | Home | الرئيسية |
| messages: Footer.shop | Shop | تسوق |
| messages: Footer.customerCare | Customer care | خدمة العملاء |
| messages: Footer.company | Company | الشركة |
| messages: Footer.contact | Contact | تواصل معنا |
| messages: Footer.followUs | Follow us | تابعنا |
| messages: Footer.payments | Payment methods | طرق الدفع |
| messages: Footer.payCod | Cash on Delivery | الدفع عند الاستلام |
| messages: Footer.payCard | Debit and credit cards | بطاقات الخصم والائتمان |
| messages: Footer.rights | All rights reserved. | جميع الحقوق محفوظة. |
| messages: Footer.cookieSettings | Cookie settings | إعدادات ملفات الارتباط |
| messages: Footer.email | Email | البريد الإلكتروني |
| messages: Footer.phone | Phone | الهاتف |
| messages: Footer.whatsapp | WhatsApp | واتساب |
| messages: Footer.address | Address | العنوان |
| messages: Footer.copyright | © {year} {brand}. | © {year} {brand}. |
| messages: Status.label | System status | حالة النظام |
| messages: Status.checking | Checking status… | جارٍ فحص الحالة… |
| messages: Status.operational | All systems operational | جميع الأنظمة تعمل |
| messages: Status.degraded | Some systems are degraded | بعض الأنظمة تعمل بأداء منخفض |
| messages: Status.down | Service disruption | انقطاع في الخدمة |
| messages: Status.unavailable | Status unavailable | الحالة غير متاحة |
| messages: Cookies.title | Your privacy choices | خياراتك للخصوصية |
| messages: Cookies.body | We use essential cookies and storage to run the store (language, theme, cart). With your permission we also use analytics to improve it. Read our <link>cookie policy</link>. | نستخدم ملفات ارتباط وتخزينًا أساسيًا لتشغيل المتجر (اللغة والمظهر والسلة). وبموافقتك نستخدم أيضًا التحليلات لتحسينه. اقرأ <link>سياسة ملفات الارتباط</link>. |
| messages: Cookies.acceptAll | Accept all | قبول الكل |
| messages: Cookies.reject | Reject non-essential | رفض غير الضروري |
| messages: Cookies.customize | Customize | تخصيص |
| messages: Cookies.save | Save choices | حفظ الاختيارات |
| messages: Cookies.essentialTitle | Essential | أساسية |
| messages: Cookies.essentialDesc | Needed for the store to work. Always on. | مطلوبة لعمل المتجر. مفعّلة دائمًا. |
| messages: Cookies.analyticsTitle | Analytics | التحليلات |
| messages: Cookies.analyticsDesc | Helps us understand how the store is used. Off unless you allow it. | تساعدنا على فهم كيفية استخدام المتجر. متوقفة ما لم توافق. |
| messages: Cookies.close | Close | إغلاق | 

### Brand copy
 | Where | English | Arabic (machine-written) |
| --- | --- | --- |
| brand: tagline | PC hardware, delivered across Egypt. | قطع الكمبيوتر وملحقاته، توصيل لجميع أنحاء مصر. |
| brand: seo.title | PC hardware store in Egypt | متجر قطع الكمبيوتر في مصر |
| brand: seo.description | Shop CPUs, graphics cards, motherboards, memory, storage and ready-built gaming PCs, with Cash on Delivery across Egypt. | تسوّق المعالجات وكروت الشاشة واللوحات الأم والذاكرة والتخزين وأجهزة الألعاب الجاهزة مع الدفع عند الاستلام في جميع أنحاء مصر. | 

### Category names (temporary static tree; moves to the database in M3a)
 | Where | English | Arabic (machine-written) |
| --- | --- | --- |
| category: components | Components | المكونات |
| category: components/cpus | CPUs | المعالجات |
| category: components/graphics-cards | Graphics Cards | كروت الشاشة |
| category: components/motherboards | Motherboards | اللوحات الأم |
| category: components/motherboards/amd-motherboards | AMD Motherboards | لوحات AMD الأم |
| category: components/motherboards/intel-motherboards | Intel Motherboards | لوحات Intel الأم |
| category: components/memory | Memory (RAM) | الذاكرة العشوائية |
| category: components/storage | Storage | وحدات التخزين |
| category: components/storage/nvme-ssds | NVMe SSDs | أقراص NVMe |
| category: components/storage/sata-ssds | SATA SSDs | أقراص SATA |
| category: components/storage/hard-drives | Hard Drives | الأقراص الصلبة |
| category: components/power-supplies | Power Supplies | مصادر الطاقة |
| category: components/cases | Cases | صناديق الكمبيوتر |
| category: components/cooling | Cooling | التبريد |
| category: components/cooling/air-coolers | Air Coolers | مبردات هوائية |
| category: components/cooling/liquid-coolers | Liquid Coolers | مبردات مائية |
| category: components/cooling/case-fans | Case Fans | مراوح الصندوق |
| category: pc-bundles | PC Bundles | تجميعات الكمبيوتر |
| category: pc-bundles/gaming-pcs | Gaming PCs | أجهزة الألعاب |
| category: pc-bundles/workstations | Workstations | محطات العمل |
| category: pc-bundles/office-pcs | Office PCs | أجهزة المكتب |
| category: pc-bundles/budget-builds | Budget Builds | تجميعات اقتصادية |
| category: laptops | Laptops | اللابتوب |
| category: laptops/gaming-laptops | Gaming Laptops | لابتوب الألعاب |
| category: laptops/ultrabooks | Ultrabooks | ألترابوك |
| category: laptops/business-laptops | Business Laptops | لابتوب الأعمال |
| category: monitors | Monitors | الشاشات |
| category: monitors/gaming-monitors | Gaming Monitors | شاشات الألعاب |
| category: monitors/ultrawide-monitors | Ultrawide Monitors | شاشات عريضة |
| category: monitors/office-monitors | Office Monitors | شاشات المكتب |
| category: monitors/4k-monitors | 4K Monitors | شاشات 4K |
| category: peripherals | Peripherals | الملحقات الطرفية |
| category: peripherals/keyboards | Keyboards | لوحات المفاتيح |
| category: peripherals/mice | Mice | الفأرات |
| category: peripherals/headsets | Headsets | سماعات الرأس |
| category: peripherals/webcams | Webcams | كاميرات الويب |
| category: networking | Networking | الشبكات |
| category: networking/routers | Routers | الراوترات |
| category: networking/wifi-adapters | Wi-Fi Adapters | كروت الواي فاي |
| category: networking/network-switches | Network Switches | سويتشات الشبكة |
<!-- prettier-ignore-end -->
