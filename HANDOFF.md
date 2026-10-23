# Gearage — HANDOFF

> Resume rule: a new chat must be able to continue from this file alone. Update it every milestone.

## 1. Status (2026-10-21)

- Proposal **approved**. **M0**, **M1a**, **M1b**, **M2a**, **M2b** and **M3a-1** (DB-served menu, category listings, filters, pagination, SEO policy; see section 11) are **delivered**. M3a was split (owner allowed it): **M3a-2 (home page sections) is next**. Ask the owner before starting it.
  Owner verified M2b locally (Node 22.23.3): seed created 53 categories, 21 brands, 79 products, 6 bundles, 251 images and a second run was "already up to date"; test:db 126 passed; 336 unit tests and all gates passed; CI on main green.
- Owner verified M1b locally and pushed: tokens, contrast, brand, lint, typecheck and 158 unit tests pass; e2e 147/151 on the first run (12 workers, dev server; the 4 failures were cold-start flakes and passed on rerun); CI on main green including e2e on the production build.
- M2b scope: `prisma/seed/` (per-family data files, validator, idempotent runner, SVG placeholder generator), `docs/SEEDING.md` (with a generated, CI-checked "specs to verify" list), `docs/ASSETS.md`, ADR 0015. Conventions: see ADR 0015 and docs/SEEDING.md.
- M2a scope: money, pricing, stock/reservations, bundles, compatibility and the storage interface. **Promo codes are NOT in M2a** (M6a). Catalog pages, search and listings UI are M3a/M3b/M4.
- Pinned versions (ADR 0011): Next 16.4.2 (with eslint-config-next 16.4.2; the owner upgraded both on 2026-10-22, keep them), React 19.3.0, TypeScript 6.0.3 (typescript-eslint caps below 6.1), Prisma 7.10.0
  (CLI `latest` tag is an 8.0 RC), Zod 4.6.5, ESLint 10.12.0, Vitest 5.0.3, Tailwind 4.3.3, next-intl 4.14.9, @fontsource/ibm-plex-sans(-arabic) 5.3.0,
  radix-ui 1.7.0, lucide-react 1.55.0, zustand 5.0.15, @formatjs/icu-messageformat-parser 3.5.21 (dev, message parity test).
  **Dependabot ignores major bumps** of typescript, @types/node, next, react, react-dom, prisma, @prisma/client, @prisma/adapter-pg (added: it must move with Prisma) and eslint unless the owner asks; bumps happen inside milestones, never by merging PRs between zips.
- Node: `engines.node` = `>=22.22.2 <23`; the owner's `.nvmrc` is `22` and CI uses `node-version-file: .nvmrc`; `.npmrc` has `engine-strict=true`.
- Owner environment: Windows (Git Bash), Node 22.23.3, **local Postgres (no Docker)**, `.env` (local) and `.env.production` (future prod, local-only), both gitignored. Owner repo files to keep: `.gitattributes` (`* text=auto eol=lf`) and `desktop.ini` in `.gitignore`.
- **Hand-written migration**: `20261014000000_catalog_inventory` was written by hand (Prisma engines are blocked in the authoring sandbox). Drift against schema.prisma is verified by the owner locally and by CI on every push; see README "Verifying a hand-written migration" and known issue 21. **Verified by the owner on 2026-10-19: `migrate dev` applied it and `migrate diff` reported no difference.**

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

| #       | Milestone                                     | Notes                                                                                                                                                                                   |
| ------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0      | Foundations                                   | Scaffold, tooling, CI, Docker, Zod env, Prisma baseline, health, cron skeleton, ADRs, HANDOFF                                                                                           |
| M1a     | Design tokens, themes, i18n/RTL, fonts        | **DELIVERED.** Contrast verified by script; brand config; logos; real-browser e2e matrix                                                                                                |
| M1b     | Shell                                         | **DELIVERED.** Header (top bar, search, account/wishlist/cart badge, mega-menu, sticky), mobile drawer, footer + status dot, cookie banner, cached `/api/status`                        |
| M2a     | Catalog schema, domain logic, services, tests | **DELIVERED.** Money, pricing, stock/reservations (locking, concurrency-tested), bundles (derived price and stock views), compatibility, specs validation, storage interface, `test:db` |
| M2b     | Seed, placeholders, docs                      | **DELIVERED.** Idempotent seed (per-category data files), SVG placeholders, SEEDING.md, ASSETS.md, seeded-bundle compatibility test. Prices illustrative. Leave EAN null unless known        |
| M3a-1   | Menu from DB, listings, filters               | **DELIVERED.** Category tree from the DB, listing engine (3 statements, disjunctive facets), URL-synced filters from SpecDefinition, numbered pagination, SEO policy (ADR 0016), cards, skeletons, empty states |
| **M3a-2** | Home page                                   | **NEXT.** Hero, category tiles, deals, featured (tag `featured`), best sellers, most viewed, new arrivals, brand strip, all from seeded data, via `queryListing` with `withFacets:false`. Home keeps ISR; set `revalidate = 300` on the page (stock labels) |
| M3b     | Product + bundle pages                        | Gallery, showcase rendering, JSON-LD, sitemap (add real paths to `lib/sitemap.ts#INDEXABLE_PATHS`)                                                                                      |
| M4      | Search and discovery                          | FTS + trigram, suggestions, compare, recently viewed, view tracking                                                                                                                     |
| M5a     | Auth core                                     | Register, login, verify, OTP, reset, Argon2id, HIBP, rate limit, lockout, Brevo outbox                                                                                                  |
| M5b     | Account security                              | Sessions list, email change, profile, addresses, audit log, admin TOTP                                                                                                                  |
| M6a     | Cart, promo, shipping                         | Cart merge, promo engine, shipping zones/fees                                                                                                                                           |
| M6b     | COD checkout and orders                       | Atomic order creation, state machine, confirmation email, order history                                                                                                                 |
| M7      | Online payments                               | Paymob, HMAC webhook, idempotency, payment state machine, reservation expiry                                                                                                            |
| **M7b** | `/status` page (**APPROVED by owner**)        | Full localized page: website/API/DB/email/payments, coarse states, cached, rate-limited                                                                                                 |
| M8a     | Reviews, wishlist, notifications              |                                                                                                                                                                                         |
| M8b     | Returns, refunds, invoices                    | HTML invoice, PDF spike, data export and deletion                                                                                                                                       |
| M9      | Admin I                                       | RBAC, orders management, inventory adjustments, overview                                                                                                                                |
| M10a    | Admin catalog CRUD + uploads                  |                                                                                                                                                                                         |
| M10b    | Showcase editor + bundle builder              | Live stock and margin preview                                                                                                                                                           |
| M11     | Admin III                                     | Promos, shipping, customers, moderation, inbox, CSV, bulk edit                                                                                                                          |
| M12     | Trust pages                                   | Legal drafts (flagged for review), FAQ, contact, branch locator                                                                                                                         |
| M13a    | Hardening                                     | Sentry, CSP audit, Lighthouse, a11y (LTR + RTL), Playwright suites                                                                                                                      |
| M13b    | Release docs                                  | README, ERD, deploy guide Include the **Launch blockers** checklist (section 10). |
| M14+    | Optional                                      | PC Builder UI, bundle customize, installments, abandoned cart                                                                                                                           |

Seed shipped in **M2b**. Status: dot in M1b (website/API/DB via cached `/api/status`), full page M7b, because it needs the rate-limit layer (M5a), the email outbox (M5a) and a payments probe (M7).
M1b note: the shadcn CLI fetches from ui.shadcn.com, which may be blocked in the sandbox; if so, Radix-based components are written by hand in shadcn style (tokens already use shadcn names). Showcase: schema M2a, seed blocks M2b, rendering M3b, admin editing M10b.

## 7. Extras (approved)

Adopt: outbox + retries, idempotency keys, store settings (COD fee/max, free-shipping threshold, maintenance), price history,
SEO redirects, back-in-stock, newsletter (double opt-in), low-stock alerts, zero-result search analytics, admin TOTP,
WhatsApp button, PDPL tooling. Defer: abandoned cart, installments, product Q&A, gift cards, PC Builder UI.
Cut: Cloudinary provider, PWA, live chat, loyalty, multi-currency, multi-vendor.

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
- **Money** is integer piastres, only through `domain/money` (allocation by largest remainder, VAT, formatting). Bundle prices and bundle stock are DERIVED (views `product_pricing`, `product_availability`), never stored; each view has a TypeScript twin and a randomized parity test.
- **Time zones**: all times are UTC. SQL uses `timezone('UTC', now())`, raw SQL passes `"...Z"::timestamp` via `utc()`, services take an explicit `now` and set `createdAt` themselves, no CHECK may depend on a `DEFAULT CURRENT_TIMESTAMP`. The DB suite must pass under Node and DB session zones UTC, Africa/Cairo, America/Los_Angeles and Pacific/Kiritimati.
- **Stock changes**: only through `server/services/inventory.service.ts`. Every operation locks inventory rows in ascending product id (`lockInventory`), re-measures under the lock, writes in one transaction (all-or-nothing) and takes an optional `tx` so order creation and stock can share a transaction (M6b).
- **Database invariants** (CHECKs, triggers, views) are part of the design (ADR 0014). New constraints get a test in `tests/db/schema.db.test.ts` that attacks them.
- **Hand-written migrations**: allowed only when the engine is unavailable; follow Prisma naming exactly, say so in the file header and the changelog, and rely on CI's `migrate diff` check.
- **DB tests** live in `tests/db/*.db.test.ts`, run with `npm run test:db` on the separate `gearage_test` database only, and use the helpers in `tests/db/helpers.ts`. Create products concurrently only through `upsert`-based helpers (`makeCategory` is race-safe).
- **Unlayered CSS beats Tailwind utilities** (utilities live in a layer). Theme-swap rules (logo) are deliberately unlayered.

## 10. Known risks / open items

Vercel Hobby non-commercial; Supabase free pauses after inactivity, no PITR; Brevo free ~300 emails/day;
Egypt ETA e-invoicing is not covered by our PDF (legal review before launch); Arabic PDF shaping needs a spike (M8b);
placeholder SVGs bypass `next/image` optimization; Better Auth is newer than Auth.js (hence the wrapper).
Open bundle decisions (defaults chosen): parts-in-box; one promo code per order and bundles excluded from item-level % codes;
`soldViaBundles` counter, reviews not aggregated; bundles filter by price/availability/derived summary and compare bundle-vs-bundle only;
component-level returns refund allocated price; seed bundles use fixed price.

### Launch blockers (clear all before real launch; copied into the M13b release checklist)

1. **Verify all 56 flagged seed products** against manufacturer pages (list: docs/SEEDING.md); owner will do this before launch (decided 2026-10-21).
2. Replace illustrative prices, compare-at prices, costs, stock, warranty and delivery data with real ones; check compare-at/"Was" pricing against the Consumer Protection Law.
3. Set `CATALOG_DEMO_NOTICE=false` only after 1 and 2 (the demo notice hides only for that exact value).
4. Native review of all Arabic copy (docs/I18N_REVIEW.md); legal review of the legal pages (M12).

### Known issues (tracked)

1. **ESLint 10 peer warnings**: `eslint-config-next` 16.4.2 bundles `eslint-plugin-import` 2.32.0, `eslint-plugin-jsx-a11y` 6.10.2 and `eslint-plugin-react` whose peer ranges stop at ESLint 9 (`npm ls` shows `invalid`).
   Linting works (layering violations and `any` are still caught, verified). Revisit when those plugins widen their ranges; fallback is ESLint 9.
2. **Prisma overrides**: `package.json` `overrides` pin `mysql2` 3.24.5 and `deepmerge-ts` 8.0.2 to clear `npm audit` highs in the Prisma CLI tree (ADR 0011).
   **Revisit when Prisma patches its transitive deps** (and when Prisma 8 is stable); then delete the overrides and re-run `npm audit`.
3. **`npm audit` (all deps) reports 5 high via `braces`** (chain: eslint-config-next > @next/eslint-plugin-next > fast-glob 3.3.1 > micromatch > braces). Dev-tooling only, no patched `braces` exists, not shipped.
   The CI gate audits production deps only (`--omit=dev`, 0 findings). Revisit when `@next/eslint-plugin-next` updates fast-glob.
4. `metadataBase` build warning comes from the global `/_not-found` page (outside the locale layout); harmless. Set `APP_URL` in production.
5. `themeColor` follows the OS scheme, not the in-app theme toggle (meta tags are static). Acceptable; revisit if it matters.
6. (Resolved in M3a-1) Locale switch links keep the query string (`useSearchParams` behind a Suspense boundary), so a filtered listing keeps its filters.
7. The Arabic language label ("العربية") on English pages makes the Arabic font (weight 500) download there too; negligible.
8. Fonts are not preloaded (fontsource CSS); measure CLS/LCP in the M13a Lighthouse pass.
9. `typedRoutes` is off (conflicts with locale-prefixed hrefs).
10. All Arabic copy (UI strings, tagline, SEO text, category names) is machine-written and **needs native review**: the full list is in docs/I18N_REVIEW.md (see section 17). The list is in docs/I18N_REVIEW.md (regenerate with `npm run i18n:review`).
11. Strict CSP is not set yet (M13a). The theme init script is a constant, so allow it by SHA-256 hash.
12. (Resolved in M1b) The mega-menu panel is full-width: it is a disclosure-navigation menu anchored to the sticky header, replacing Radix NavigationMenu (which injected focusable `aria-hidden` proxies, an axe `aria-hidden-focus` violation).
13. The cart store is minimal (`lines: Record<productId, qty>`, persisted to localStorage). M6a replaces the line model (variants, bundle components, stock validation, guest-to-account merge) and keeps `useCartStore` / `selectCartCount`.
14. These pages are "coming soon" placeholders (200, noindex) until their milestone: search (M4), cart/checkout (M6), account/wishlist (M5/M8), compare, deals, legal/trust pages and branches (M12), `/status` (M7b). The header search form already targets `/{locale}/search?q=`. Also a placeholder (200, noindex): `/p/<slug>` until M3b; the product URL shape `/p/<slug>` is ratified there.
15. `/api/status` has no per-IP rate limit yet (the shared limiter arrives in M5a, applied in M7b). Until then load is bounded by three caches: one DB probe per 30s per instance, CDN `s-maxage=30`, browser `max-age=15`. It always returns 200 and only coarse states.
16. The locale layout uses ISR (`revalidate = 3600`), so edits to contact/social StoreSetting appear within an hour; admin saves will revalidate immediately in M11.
17. (Resolved in M3a-1) The category tree is served from the database (`category.service`, cached 60 s in-process); `features/navigation/categories.ts` is deleted, `features/navigation/href.ts` only builds paths.
18. The cookie banner's "Analytics" category has no consumer yet (Vercel Analytics or similar later). Consent is recorded in the first-party `consent` cookie (version, analytics flag, timestamp; about 6 months).
19. shadcn/ui is not installed through its CLI (its registry is blocked in the sandbox). Components are hand-written with Radix primitives in shadcn's style; token names already match shadcn's, so real shadcn components can be dropped in later.
20. (Resolved in M2a) Top-bar claims are no longer hardcoded: they are StoreSetting key `topbar` (empty by default, so the bar is neutral until the owner sets real values). Set them with SQL until the admin UI (M11): `INSERT INTO store_setting (key, value, "updatedAt") VALUES ('topbar', '{"lines":[{"icon":"truck","text":{"en":"...","ar":"..."}}]}', now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now();` (icons: info, truck, banknote, shield; up to 3 lines; the page refreshes within an hour).
21. (Resolved 2026-10-19) The owner ran `migrate dev` and `migrate diff`: "No difference detected", exit 0; CI repeats the diff on every push. Keep running it after any hand-written migration.
22. The DB tests ran on PostgreSQL 18.4 (an npm-packaged binary) in the authoring sandbox. CI uses `postgres:17-alpine`; the owner's local version may differ. The SQL avoids features newer than PostgreSQL 15.
23. Discount-priced bundles must NOT store a `price` (a CHECK enforces it): their price comes from the `product_pricing` view. Listings and sorting by price must read that view, never `product.price`, for bundles.
24. The job `expire-stock-reservations` runs on the `tick` cadence (GitHub Actions workflow, inactive until deployment). Correctness never depends on it (availability ignores expired reservations); it only tidies status.
25. Promo codes and the order state machine are not in M2a (M6a/M6b). `StockReservation.orderId` has no foreign key yet; M6b adds it.
26. Barcodes (EAN/GTIN): the domain validates the GS1 check digit; the seed must not invent barcodes (leave null unless known).
27. **Seed specs are unverified** (the biggest risk of M2b). They are from the author's knowledge, not datasheets; 56 of 79 products carry flagged doubts (generated list in docs/SEEDING.md, CI-checked). Board slot counts, case/cooler clearances, GPU lengths and laptop configurations are the weakest. Before launch the owner (or a later milestone) must check them against manufacturer pages; the compatibility badge is only as good as these numbers.
28. Prices, costs (88% of price), warranty months, shipping fees and delivery estimates are illustrative. Weights/dimensions are mostly empty; EAN is never seeded; MPN only where confident.
29. (Resolved in M3a-1) The menu now comes from the DB: it gained Audio & Streaming and Accessories; Gift Cards (inactive) and empty categories are hidden. Owner confirmed.
30. Shipping zones, promo codes and branches are **data only** (validated, not inserted) until M6a / M12 add their tables; those milestones add their seed step from `prisma/seed/data/{shipping-zones,promo-codes,branches}.ts`.
31. Seeded images are SVG placeholders under `public/uploads/seed/` (git-ignored) served from `/uploads`; SVG bypasses `next/image` optimization, so M3b should render seed SVGs with `unoptimized` (or via a plain `<img>`) and real raster photos through `next/image`. The `StorageProvider.urlFor` base is `STORAGE_PUBLIC_BASE_URL`.
32. Stock and counters are seeded once. To get a fresh demo state: `npx prisma migrate reset` (local only), then `npm run db:seed`.
33. Intel `tdp_w` is the 125 W base power, not the 253 W turbo power, so the PSU rule under-estimates K-series CPUs; seeded Intel bundles leave headroom. Revisit the rule (use max turbo power) when the PC Builder ships.
34. The seeded video block uses a YouTube embed id (Big Buck Bunny) written from memory; the M3b renderer must allow-list embed hosts (`www.youtube-nocookie.com`) and the id should be checked.
35. `NUMBER_LIST` is not a spec type: numeric lists (case radiator sizes) are `STRING_LIST` of integer strings (ADR 0015).
36. **Listings are dynamic** (they read `searchParams`); only the category tree and spec definitions are cached, in-process for 60 s (per warm instance on Vercel). Measure TTFB in M13a and decide on Cache Components then (ADR 0016).
37. (Resolved in the M3a-1 follow-up) Unknown or inactive categories and pages past the end are real HTTP 404s: `loading.tsx` was removed (owner decision 2026-10-22), so nothing streams before `notFound()`. Verified over HTTP on the production build. Cost: no route-level skeleton on listing navigation (`ProductGridSkeleton` remains for later use). **Open:** Next itself injects the not-found `noindex` tag (server-inserted plus a client boundary copy, see Next source); the server HTML has exactly one, but I could not verify the post-hydration DOM count without a browser, so the e2e asserts "one in server HTML, all present tags noindex".
38. **Features that depend on unverified seed data** (the UI marks them with the demo notice, never as fact): spec filters and their option counts/ranges (seed specs, issue 27); "Was" prices, percent-off badges and bundle "you save" (illustrative compare-at and prices, issue 28; compare-at pricing also needs a Consumer Protection Law check before launch); stock labels ("Only N left", seed stock). Not built yet but will depend on the same data: compatibility badges (M3b), compare (M4). They must carry the same caveat when they ship.
39. Rating sort/filter are deferred to M8a (no reviews yet). Cards have no add-to-cart, wishlist or compare yet (M6a/M8a/M4).
40. Spec/brand/tag facet SQL uses `jsonb ->>` comparisons, which do not use the GIN index on `specs`: fine at ~85 products; use the `@>` form if the catalog grows to thousands.
41. **Sandbox limits**: no browser can be installed in the authoring sandbox, so Playwright specs are written without being run by me. The owner ran the M3a-1 suite (199 passed, 36 failed); the follow-up fixes target those failures (section 11) and are UNRUN by me. Only structural axe rules ran, in jsdom, on server-rendered HTML.
42. Listings exclude products of deactivated brands (`brand.isActive`); products without a brand are always listed.

## 11. Verification record: M3a-1 (2026-10-21)

Earlier records (M0 to M2b): [docs/MILESTONE_HISTORY.md](docs/MILESTONE_HISTORY.md).

**Verified in the sandbox (real execution, PostgreSQL 18.4, the full seed):**

- Gates all pass: `format:check`, `tokens:check`, `contrast`, `brand:check`, `i18n:review:check` (550 strings), `seed:docs:check`, `lint`, `typecheck`; **373 unit tests** (36 files) and **143 DB tests** (6 files, `npm run test:db`).

- Domain unit tests: URL grammar, normalization, SEO policy, pagination window, selection removal, savings, category tree, TTL cache, storage URL parity, demo flag. Bug found by them: a half-invalid range (`1e3..5`) was accepted as `..5`; now rejected.
- `tests/db/listing.db.test.ts` (17 tests): exactly 3 statements per request (no N+1); every seeded spec facet (checkbox/enum, range/number) and synthetic list and toggle specs match an independent TypeScript implementation; disjunctive facet counts; every sort paginates disjointly and completely; default sort puts out-of-stock last; draft/archived/deleted excluded; menu tree rules (Gift Cards hidden, emptied categories drop out). Bug found by them: grouping on a bind-parameter spec key failed (fixed with GROUP BY ordinal).
- Production build with no database (CI verify path) and with the seeded database; HTTP checks on the running build: canonical/hreflang/robots for clean, filtered, page 2 and junk-parameter URLs; zero-result state; sitemap lists 104 category URLs (52 paths x 2 locales); menu categories present.
- Structural axe-core (WCAG A/AA, best-practice, no color-contrast, no layout rules) in jsdom on 8 server-rendered pages (en/ar, clean, filtered, zero-result, bundles, page 2): see issue 41 for what that does NOT cover.
- Library facts checked against the docs bundled in `next@16.4.0` (re-checked behavior on 16.4.2 by running the build): `unstable_cache` is superseded by `use cache`; `revalidate` segment config is removed only with `cacheComponents`; not-found status during streaming.

**Not verified (the owner must run):** `npm run test:db` and `npm run db:seed` locally; the Playwright suite (`npm run test:e2e`: new `listing.spec.ts` and the extended viewport matrix were never executed); a visual pass in a real browser (LTR and RTL, 320px to ultrawide, dark and light), including color contrast of the new pages; CI.

**Exact commands:** `npm ci`, `npm run db:seed` (needs the migrated DB), `npm run dev`, then open `/en/c/components/cpus`, `/ar/c/pc-bundles`, `/en/c/components?page=2`.


## 11b. M3a-1 follow-up (2026-10-22)

The owner ran e2e on a production build: 199 passed, 36 failed, 1 skipped. Fixes, all UNRUN by me in a browser:

1. **Target size (32 tests, `responsive.spec.ts`, mouse viewports, listing pages):** the 20x20 filter checkboxes. The spec requires 44x44 on the interactive element itself. Fix (UI, not the test): the real `<input>` now covers the whole row (`absolute inset-0`, invisible), so the control is the full-width 44px-high hit area and the label text is part of it; the visible box is drawn beside it and shows focus and checked state via `peer-*` classes. Native keyboard and screen-reader semantics are unchanged.
2. **`shell.spec.ts` mega-menu test:** locators scoped to the "Product categories" navigation (after navigating, "NVIDIA GeForce" is also a subcategory chip).
3. **`shell.spec.ts` sitemap:** no longer forbids `/c/`; asserts clean category paths in both locales, no query strings, no `/p/`, no Gift Cards, and the placeholder routes still absent.
4. **`shell.spec.ts` noindex:** uses real placeholders (`/en/cart`, `/en/p/anything`) and asserts that a clean category page has no robots meta while a filtered one is noindex.
5. **Unknown category:** now a real 404 (and `?page=50`, `gift-cards`); server HTML has exactly one robots tag; see issue 37 for what is not verified.

Also: `listing.spec.ts` and the viewport matrix are unchanged otherwise; `next` and `eslint-config-next` are 16.4.2.

**Verified here:** HTTP status 404 for six unknown/inactive/out-of-range URLs and 200 for clean and zero-result URLs (production build, seeded DB); exactly one robots tag in the server HTML of `/en/c/nope` and `/en/does-not-exist`; typecheck, lint, format, unit and DB tests, i18n review check. **Not verified (owner runs `npm run test:e2e` on a production build):** that the 32 target-size failures are gone (layout is not measurable without a browser; by construction the input rect equals the label row, at least 44px high and the full row wide), the focus ring on the new checkbox, dark/light look of the checked state, and the post-hydration robots-tag count.


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

## 16. Owner decisions and open questions

Decided 2026-10-12: brand orange is **`#FF5A00`**; missing logo files (wordmark-only, SVG exports of inline/stacked) will be supplied later, not blocking; the Arabic store name stays Latin ("Gearage"); `/status` page approved for M7b; [ADR 0013](docs/adr/0013-server-side-structure.md) (next-safe-action from M5a, plain Route Handlers for webhooks/cron/health/status, Hono deferred).
Decided 2026-10-14: top bar targets 32px with a mouse and 44px on touch; wishlist hidden below 640px and reachable from the drawer; "coming soon" placeholders stay (200, noindex) and stay OUT of the sitemap (enforced by `lib/sitemap.ts` + tests); top-bar claims are StoreSetting values, neutral until shipping zones are confirmed; the Arabic review list lives in docs/I18N_REVIEW.md and the owner does one native pass later.

Open for the owner:

1. **Dependabot**: I also ignore major bumps of `@prisma/adapter-pg` (not on your list) because it must move with `prisma` and `@prisma/client`. Remove it from `.github/dependabot.yml` if you disagree.
2. (Answered 2026-10-19) Neutral top bar is fine until shipping zones are confirmed in M6a.
3. (Answered 2026-10-21) Seed spec spot-check deferred to before launch: tracked as a launch blocker (section 10).
4. (Answered 2026-10-21) M3a scope approved without cuts; split into M3a-1 (delivered) and M3a-2 (home).
5. **Bundle defaults** (section 10) are what the seed implements: parts-in-box, one promo per order, fixed prices, bundles carry only editorial specs. Say if you want any changed before M3b/M6.
6. (Answered 2026-10-22) 404 status: real 404, skeleton dropped (issue 37).

## 17. Needs native review: machine-written Arabic

The full list lives in **[docs/I18N_REVIEW.md](docs/I18N_REVIEW.md)** (generated; do not edit by hand). Run `npm run i18n:review` after adding strings; CI runs `npm run i18n:review:check`.
The owner will do one native-review pass later, once more copy exists. Until then, treat every Arabic string as unreviewed.
