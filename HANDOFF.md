# Gearage — HANDOFF

> Resume rule: a new chat must be able to continue from this file alone. Update it every milestone.

## 1. Status (2026-10-09)

- Proposal **approved** (all defaults, plus the changes in §3).
- **M0 delivered** (foundations, §8). Next: **M1a** (design tokens, light/dark themes, next-intl + RTL, fonts, contrast script).
- Pinned versions (see ADR 0011): Next 16.4.0, React 19.3.0, TypeScript 6.0.3 (typescript-eslint caps below 6.1), Prisma 7.10.0
  (CLI `latest` tag is an 8.0 RC; stay on 7.x until stable), Zod 4.6.5, ESLint 10.12.0, Vitest 5.0.3, Tailwind 4.3.3.
  `overrides` for `mysql2` and `deepmerge-ts` clear 4 high `npm audit` findings in the Prisma CLI tree.
- Sandbox limits seen in M0: `binaries.prisma.sh` and the Playwright CDN return 403, so `prisma migrate diff` and browser e2e
  cannot run in the sandbox. `prisma validate`/`generate` work only with a stub engine
  (`PRISMA_SCHEMA_ENGINE_BINARY=/tmp/fake-schema-engine`, a no-op script). Real machines need nothing special.

## 2. Product and brand

- Gearage: PC hardware store for Egypt. EGP as integer piastres. COD first-class. English + Arabic (RTL).
- Brand (sampled from logo.png): orange `#F56514`, dark surface `#0D1114`, white for gear and wordmark.
- Contrast (hand-calculated, **verify by script in M1**): orange on white ≈ 3.1:1 (fails AA text);
  white on orange ≈ 3.1:1 (fails normal text); dark ink on orange ≈ 6:1.
  => orange buttons use **dark labels**; light-mode text links use a darker orange token (candidate `#C2410C`, ≈ 5.2:1).
- Logo files go in `public/brand/` once final; text placeholder until then.

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
| M1a     | Design tokens, themes, i18n/RTL, fonts        | Contrast verified by script                                                                   |
| M1b     | Shell                                         | Header, footer, mega-menu, mobile drawer, cookie banner                                       |
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

Seed ships in **M2b**. Showcase: schema M2a, seed blocks M2b, rendering M3b, admin editing M10b.

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

## 10. Known risks / open items

Vercel Hobby non-commercial; Supabase free pauses after inactivity, no PITR; Brevo free ~300 emails/day;
Egypt ETA e-invoicing is not covered by our PDF (legal review before launch); Arabic PDF shaping needs a spike (M8b);
placeholder SVGs bypass `next/image` optimization; Better Auth is newer than Auth.js (hence the wrapper).
Open bundle decisions (defaults chosen): parts-in-box; one promo code per order and bundles excluded from item-level % codes;
`soldViaBundles` counter, reviews not aggregated; bundles filter by price/availability/derived summary and compare bundle-vs-bundle only;
component-level returns refund allocated price; seed bundles use fixed price.

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
