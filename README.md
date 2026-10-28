# Gearage

Production-grade PC hardware e-commerce platform for Egypt: EGP pricing, Cash on Delivery, English and Arabic (RTL), light and dark themes, PC bundles.

> Status: **M2a** (design system, i18n/RTL, store shell, catalog and inventory foundations). The storefront pages and checkout are not built yet.
> "Gearage" is a working name; it lives only in `src/config/brand.ts` ([docs/BRAND.md](docs/BRAND.md)).

<!-- Screenshots / GIFs arrive with the storefront milestones. -->

## Stack

Next.js 16 (App Router, `proxy.ts`) · React 19 · TypeScript strict · Tailwind CSS v4 · next-intl 4 · PostgreSQL + Prisma 7 · Zod 4 ·
Vitest + Testing Library · Playwright + axe. Fonts: IBM Plex Sans / IBM Plex Sans Arabic via `@fontsource` (self-hosted). Reasons live in [docs/adr](docs/adr).

## Local setup

Requirements: Node `22.12.0` or any 22.x >= 22.12 (`nvm use` reads `.nvmrc`; `engine-strict` is on), and a **local PostgreSQL** (your own install, or Docker, which is optional).

```bash
git init                      # once, so Husky hooks install (skip if already a repo)
cp .env.example .env          # set CRON_SECRET (openssl rand -base64 48) and your local DB credentials
createdb gearage              # or CREATE DATABASE gearage; in psql/pgAdmin
npm install                   # also runs `prisma generate`
npx prisma migrate dev        # applies migrations to your LOCAL database
npm run dev                   # http://localhost:3000  ->  redirects to /en or /ar
```

No local Postgres? `docker compose up -d` starts one with the defaults used in `.env.example` (`postgres/postgres`, db `gearage`).

Check: `curl localhost:3000/api/health` and `curl localhost:3000/api/health/ready`. In development the design reference is at `/en/styleguide`.

## Environments and secrets

| File / place                   | Purpose                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env`                         | Local development. Gitignored.                                                                                                                                                              |
| `.env.production`              | Optional, **local-only** reference for a production-like run on your machine. Gitignored. Note: `next build`/`next start` load it automatically.                                            |
| Vercel > Environment Variables | The real production and preview values (Supabase **pooled** `DATABASE_URL` on port 6543 with `?pgbouncer=true`, **direct** `DIRECT_URL` on port 5432, `CRON_SECRET`, ...). Never committed. |
| `.env.example`                 | Committed template with no secrets.                                                                                                                                                         |

**Database safety:** `prisma migrate dev`, `migrate reset`, `db push`, `db seed`, `db execute` and `prisma studio` **refuse to run unless the database host is local**
(`prisma/guard.ts`, enforced in `prisma.config.ts` and the seed; no override). Production is migrated only with `npx prisma migrate deploy`.

## Scripts

| Script                                             | Purpose                                                                                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`                  | Next.js                                                                                                                       |
| `npm run lint` / `typecheck`                       | ESLint (incl. layering rules) / `next typegen` + `tsc`                                                                        |
| `npm test`                                         | Vitest unit and component tests                                                                                               |
| `npm run test:e2e`                                 | Playwright: viewport matrix (LTR+RTL), axe, i18n, theme, SEO. Needs `npx playwright install chromium` once and a valid `.env` |
| `npm run tokens:build` / `tokens:check`            | Generate / verify `src/styles/tokens.css` from `src/design/tokens.ts`                                                         |
| `npm run contrast`                                 | WCAG AA gate for every token pair in both themes                                                                              |
| `npm run brand:check`                              | Fails if the store name is hardcoded outside config/messages/docs                                                             |
| `npm run i18n:review` / `i18n:review:check`        | Regenerate / verify docs/I18N_REVIEW.md (machine-written Arabic for native review)                                            |
| `npm run test:db`                                  | DB-backed tests (stock, concurrency, constraints, views) on the separate `gearage_test` database only                         |
| `npm run brand:assets`                             | Re-derive `public/brand/*` and favicons from `design/brand-source/`                                                           |
| `npm run format` / `format:check`                  | Prettier                                                                                                                      |
| `npm run db:migrate` / `db:deploy` / `db:validate` | Prisma                                                                                                                        |
| `npm run db:seed`                                  | Idempotent catalog seed (local database only; see [docs/SEEDING.md](docs/SEEDING.md))                                         |
| `npm run search:try -- "query"`                    | Run the real search pipeline against `DATABASE_URL` (read-only): tier, matches, top results                                   |
| `npm run seed:docs` / `seed:docs:check`            | Regenerate / verify the generated block of docs/SEEDING.md (specs to verify)                                                  |

## Search

Postgres full-text search plus `pg_trgm`, no extra service: one weighted document per product in English and Arabic,
Arabic normalization shared by the index (SQL) and the query (TypeScript), a synonym list for product types, brands and
units in both languages, model numbers that match however they are typed, and typo tolerance against the catalog's own
words. `/search` is also the all-products, deals, best-sellers and new-arrivals view. Decisions:
[ADR 0019](docs/adr/0019-search.md); measured quality and limits: [docs/SEARCH_QUALITY.md](docs/SEARCH_QUALITY.md).
The migration is hand-written: run the drift check below after `prisma migrate dev`.

## Compare and recently viewed

Up to four products side by side at `/compare?p=slug,slug` (a shareable, server-rendered page): products of the same
spec family only (all graphics cards together, whatever the brand), bundles with bundles, differences marked, no
"best" claims. The compare list and the "recently viewed" shelf live in the browser only (nothing is sent to the
server). Decisions: [ADR 0020](docs/adr/0020-compare-and-recently-viewed.md).

## Demo data (`npm run db:seed`)

An idempotent seed fills your **local** database with realistic catalog data: 9 top-level categories (53 in the tree) with
spec definitions, 21 brands, 79 products with stock (including low and out-of-stock items), 6 PC bundles, showcase blocks and
generated placeholder images. It creates no users, orders or reviews and is safe to run repeatedly (a second run changes nothing).
Prices are **illustrative**, specs are flagged where unverified, and **demo images are generated placeholders**; the system is
built to use official brand assets supplied with permission. See [docs/SEEDING.md](docs/SEEDING.md) and [docs/ASSETS.md](docs/ASSETS.md).

## Database tests (`npm run test:db`)

The stock, concurrency, constraint and view tests need a real PostgreSQL, so they run against a **separate database**, never your development one.

- **Which database**: `TEST_DATABASE_URL` if set; otherwise your `DATABASE_URL` with the database swapped for `gearage_test` (same server, user and password).
- **Create it** (optional: the runner creates it for you when your user has `CREATEDB`):

  ```bash
  createdb gearage_test                       # or, in psql / pgAdmin:  CREATE DATABASE gearage_test;
  # Windows / Git Bash, if createdb is not on PATH:
  psql -U postgres -c "CREATE DATABASE gearage_test;"
  ```

- **What it does** each run: connects, **drops and recreates the `public` schema of `gearage_test`**, applies every `prisma/migrations/*/migration.sql` in order, then runs `tests/db/**/*.db.test.ts` one file after another.
- **Safety, three layers**: (1) the same local-host guard as `prisma migrate dev` (a non-local host is refused); (2) the database name must end in `_test` and must not be your development database (`localhost`, `127.0.0.1` and `::1` count as the same server); (3) every worker re-checks it, and the table reset re-checks `current_database()` before wiping anything.
- **CI** runs it in the e2e job against the Postgres service (`gearage_test` is created there).

## Verifying a hand-written migration

Some migrations (currently `20261014000000_catalog_inventory`) were written by hand because the Prisma engines could not be downloaded where they were authored. They follow Prisma's naming so the schema should show no drift. Verify locally, in this order:

```bash
npx prisma migrate dev        # applies it to your local DB; prisma also compares with schema.prisma via a shadow DB
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code
npm run test:db               # exercises every constraint, trigger and view on gearage_test
```

`migrate diff --exit-code` returns **0** when the database matches `schema.prisma`, **2** when it differs (it prints the differences; add `--script` to see the SQL), **1** on an error.
If `migrate dev` offers to create a new migration, the schema and the SQL differ: answer no and send me the output. Objects Prisma does not model on purpose (CHECK constraints, triggers, the two views, and the partial unique indexes `product_*_active_uq`) are not part of the comparison; if `migrate diff` ever lists them, tell me.
CI runs the same `migrate diff` against a fresh Postgres on every push.

## Environment variables

| Variable                                        | Required | Purpose                                                                                                                                                                         |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                  | yes      | Runtime Postgres URL (pooled in production)                                                                                                                                     |
| `DIRECT_URL`                                    | no       | Direct URL for migrations (falls back to `DATABASE_URL`)                                                                                                                        |
| `CRON_SECRET`                                   | yes      | Bearer secret for `/api/cron/*`, min 32 chars                                                                                                                                   |
| `APP_URL`                                       | no       | Public base URL for metadata and absolute links (default `http://localhost:3000`)                                                                                               |
| `LOG_LEVEL`                                     | no       | `debug` / `info` / `warn` / `error`                                                                                                                                             |
| `ENABLE_STYLEGUIDE`                             | no       | `1` exposes `/{locale}/styleguide` outside `next dev` (e2e on a production build). Keep `0` in production                                                                       |
| `TEST_DATABASE_URL`                             | no       | Database for `npm run test:db`. Must be local and end in `_test`. Default: `DATABASE_URL` with the database `gearage_test`                                                      |
| `STORAGE_PROVIDER`                              | no       | `local` (default). `supabase` and `cloudinary` are planned (M10a)                                                                                                               |
| `STORAGE_LOCAL_DIR` / `STORAGE_PUBLIC_BASE_URL` | no       | Where the local provider writes (`public/uploads`) and serves (`/uploads`)                                                                                                      |
| `CATALOG_DEMO_NOTICE`                           | no       | `true` (default) shows a "demo catalog" notice because the seed is illustrative. Set `false` only at launch, after real prices and verified specs (see HANDOFF launch blockers) |

## Brand note

Demo/brand artwork is used as supplied by the owner (`design/brand-source/`); product images will be generated placeholders, and the system supports official brand assets (see `docs/ASSETS.md`).

## Docs

[Architecture](docs/ARCHITECTURE.md) · [Brand](docs/BRAND.md) · [Security](docs/SECURITY.md) · [Arabic review](docs/I18N_REVIEW.md) · [Milestone history](docs/MILESTONE_HISTORY.md) · [ADRs](docs/adr)

## License

MIT. See [LICENSE](LICENSE).
