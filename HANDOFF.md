# Gearage — HANDOFF

> Resume rule: a new chat must be able to continue from this file alone. Update it every milestone.

## 1. Status (2026-10-11)

- Proposal **approved**. **M0** (foundations) and **M1a** (design tokens, light/dark, next-intl + RTL, fonts, brand config, logos) are **delivered**.
  Next: **M1b** (shell). Ask the owner before starting it, and see §16 open questions first.
- Pinned versions (ADR 0011): Next 16.4.0, React 19.3.0, TypeScript 6.0.3 (typescript-eslint caps below 6.1), Prisma 7.10.0
  (CLI `latest` tag is an 8.0 RC), Zod 4.6.5, ESLint 10.12.0, Vitest 5.0.3, Tailwind 4.3.3, next-intl 4.14.9, @fontsource/ibm-plex-sans(-arabic) 5.3.0.
- Node: `.nvmrc` = 22.12.0 (the owner's version), `engines.node` = `>=22.12.0 <23`, `.npmrc` has `engine-strict=true`; CI uses `node-version-file: .nvmrc`.
- Owner environment: Windows (Git Bash), Node 22.12.0, **local Postgres (no Docker)**, `.env` (local) and `.env.production` (future prod, local-only), both gitignored.

## 2. Product and brand

- Gearage: PC hardware store for Egypt. EGP as integer piastres. COD first-class. English + Arabic (RTL). **"Gearage" is a working name.**
- Brand colors (owner-confirmed): orange `#F56514`, dark surface `#0D1114`. Defined once in `src/design/tokens.ts` (`brandColors`).
- Contrast is now **verified by script** (60 pairs, both themes, `npm run contrast`, CI gate): brand orange on white is 3.11:1 (fails AA text),
  dark ink on orange 6.10:1, `#C2410C` link on white 5.18:1. Bright orange = fills with dark labels; light-mode orange text uses `#C2410C`.
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

| #       | Milestone                                     | Notes                                                                                         |
| ------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| M0      | Foundations                                   | Scaffold, tooling, CI, Docker, Zod env, Prisma baseline, health, cron skeleton, ADRs, HANDOFF |
| M1a     | Design tokens, themes, i18n/RTL, fonts        | **DELIVERED.** Contrast verified by script; brand config; logos; real-browser e2e matrix      |
| M1b     | Shell                                         | Header, footer (with status dot), mega-menu, mobile drawer, cookie banner, `/api/status`      |
| **M2a** | Catalog schema, domain logic, services, tests | Money, pricing, stock/reservations, bundles, compatibility, storage interface                 |
| **M2b** | Seed, placeholders, docs                      | Idempotent seed, SVG placeholders, SEEDING.md, ASSETS.md, seeded-bundle compatibility test    |
| M3a     | Home, listings, filters                       | URL-synced filters, sorting, pagination                                                       |
| M3b     | Product + bundle pages                        | Gallery, showcase rendering, JSON-LD, sitemap                                                 |
| M4      | Search and discovery                          | FTS + trigram, suggestions, compare, recently viewed, view tracking                           |
| M5a     | Auth core                                     | Register, login, verify, OTP, reset, Argon2id, HIBP, rate limit, lockout, Brevo outbox        |
| M5b     | Account security                              | Sessions list, email change, profile, addresses, audit log, admin TOTP                        |
| M6a     | Cart, promo, shipping                         | Cart merge, promo engine, shipping zones/fees                                                 |
| M6b     | COD checkout and orders                       | Atomic order creation, state machine, confirmation email, order history                       |
| M7      | Online payments                               | Paymob, HMAC webhook, idempotency, payment state machine, reservation expiry                  |
| **M7b** | `/status` page (**PROPOSED, needs approval**) | Full localized page: website/API/DB/email/payments, coarse states, cached, rate-limited       |
| M8a     | Reviews, wishlist, notifications              |                                                                                               |
| M8b     | Returns, refunds, invoices                    | HTML invoice, PDF spike, data export and deletion                                             |
| M9      | Admin I                                       | RBAC, orders management, inventory adjustments, overview                                      |
| M10a    | Admin catalog CRUD + uploads                  |                                                                                               |
| M10b    | Showcase editor + bundle builder              | Live stock and margin preview                                                                 |
| M11     | Admin III                                     | Promos, shipping, customers, moderation, inbox, CSV, bulk edit                                |
| M12     | Trust pages                                   | Legal drafts (flagged for review), FAQ, contact, branch locator                               |
| M13a    | Hardening                                     | Sentry, CSP audit, Lighthouse, a11y (LTR + RTL), Playwright suites                            |
| M13b    | Release docs                                  | README, ERD, deploy guide                                                                     |
| M14+    | Optional                                      | PC Builder UI, bundle customize, installments, abandoned cart                                 |

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
10. Arabic copy (tagline, SEO text, UI strings) was written by the assistant and **needs native review** before launch.
11. Strict CSP is not set yet (M13a). The theme init script is a constant, so allow it by SHA-256 hash.

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

## 14. Environment strategy

- Local: `.env` (from `.env.example`) with a local Postgres. `.env.production` is a local-only convenience for production-like runs (`next build`/`start` load it); never commit it.
- Production/preview: variables set in Vercel (Production and Preview separately). Supabase `DATABASE_URL` = pooled (6543, `?pgbouncer=true`), `DIRECT_URL` = direct (5432). `CRON_SECRET` >= 32 chars. `APP_URL` = public URL. `ENABLE_STYLEGUIDE` stays `0`.
- Migrations: local `prisma migrate dev`; production **only** `prisma migrate deploy`. `prisma/guard.ts` refuses `migrate dev|reset`, `db push|seed|execute` and `studio` on any non-local host (no override).
- `.github/workflows/cron-tick.yml` is **inactive** (manual dispatch only). To activate after deployment: add repo secrets `APP_URL` and `CRON_SECRET`, uncomment the `schedule` block.

## 15. Requirements added after approval (2026-10-11), all tracked here

- **Brand and theming**: tokens as CSS variables only; light AND dark (dark brand-native); darker orange token for text on light; brand colors `#F56514`/`#0D1114`; favicon, OG image and email templates follow the palette (emails: M5a).
- **Centralized branding**: typed brand config, colors in tokens, contact/social in `StoreSetting`; never hardcode the name; CI check (done in M1a). Interpolate the name in messages, emails, legal pages, metadata, JSON-LD, OG images and invoices (use `brandVars`/`storeName`).
- **Bundle risks** (proposal items, tracked in ADR 0010 and the M2a checklist): refund/invoice allocation per component (snapshot allocated price, VAT, promo share, cost); aggregate component stock checks across cart lines with deterministic lock ordering; components are physical products only (no nesting), deletion restricted, bundle auto-unavailable if a component is archived; derived stock computed in SQL for listings (no N+1); fixed bundles first, customize later but order snapshots already store the actual chosen components; compatibility rules as a pure tested module, with a test that all seeded bundles pass it; open decisions listed in §10.
- **/status page**: public, localized, overall + website/API/database/email/payments, coarse states only (operational/degraded/down, no versions/hostnames/errors), cached and polled gently (no live DB/third-party call per visit), rate-limited, current status only, footer dot linking to it. Footer dot ships with the shell (M1b); full page proposed for **M7b** (needs approval).
- **Responsive**: mobile-first 320px to ultra-wide, no horizontal page scroll, 44px targets, fluid type/spacing, tables/mega-menu/galleries adapted per breakpoint; verified every milestone on the fixed matrix in `tests/e2e/viewports.ts` in LTR and RTL.

## 16. Open questions for the owner

1. **Orange mismatch**: the supplied logo artwork (SVG and PNG) is exactly `#FF5A00`; tokens use your confirmed `#F56514`. Orange buttons next to the logo will differ slightly. Keep `#F56514` (current) or switch the token to `#FF5A00`? (Contrast: `#FF5A00` is ~3.1:1 on white like `#F56514`, ink-on-orange stays AA.) One-line change in `tokens.ts`.
2. **Logo variants missing**: no wordmark-only file; inline and stacked logos are PNG only (no SVG). Not blocking. Supply them if you want them.
3. **"Main logo as an image"**: only the zip arrived; no separate image was visible to the assistant.
4. **Arabic store name**: the config falls back to the English name for Arabic. Provide an Arabic spelling if you want one.
5. **Arabic copy** needs a native review (tagline, SEO text, UI strings).
6. Approve the **/status page at M7b** (footer dot in M1b)?
