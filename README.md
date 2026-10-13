# Gearage

Production-grade PC hardware e-commerce platform for Egypt: EGP pricing, Cash on Delivery, English and Arabic (RTL), light and dark themes, PC bundles.

> Status: **M1b** (foundations, design system, i18n/RTL, store shell). The catalog and checkout are not built yet. See [HANDOFF.md](HANDOFF.md) for status and the roadmap.
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

| Script                                                         | Purpose                                                                                                                       |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`                              | Next.js                                                                                                                       |
| `npm run lint` / `typecheck`                                   | ESLint (incl. layering rules) / `next typegen` + `tsc`                                                                        |
| `npm test`                                                     | Vitest unit and component tests                                                                                               |
| `npm run test:e2e`                                             | Playwright: viewport matrix (LTR+RTL), axe, i18n, theme, SEO. Needs `npx playwright install chromium` once and a valid `.env` |
| `npm run tokens:build` / `tokens:check`                        | Generate / verify `src/styles/tokens.css` from `src/design/tokens.ts`                                                         |
| `npm run contrast`                                             | WCAG AA gate for every token pair in both themes                                                                              |
| `npm run brand:check`                                          | Fails if the store name is hardcoded outside config/messages/docs                                                             |
| `npm run i18n:review`                                          | Lists every machine-written Arabic string for native review                                                                   |
| `npm run brand:assets`                                         | Re-derive `public/brand/*` and favicons from `design/brand-source/`                                                           |
| `npm run format` / `format:check`                              | Prettier                                                                                                                      |
| `npm run db:migrate` / `db:deploy` / `db:validate` / `db:seed` | Prisma                                                                                                                        |

## Environment variables

| Variable            | Required | Purpose                                                                                                   |
| ------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | yes      | Runtime Postgres URL (pooled in production)                                                               |
| `DIRECT_URL`        | no       | Direct URL for migrations (falls back to `DATABASE_URL`)                                                  |
| `CRON_SECRET`       | yes      | Bearer secret for `/api/cron/*`, min 32 chars                                                             |
| `APP_URL`           | no       | Public base URL for metadata and absolute links (default `http://localhost:3000`)                         |
| `LOG_LEVEL`         | no       | `debug` / `info` / `warn` / `error`                                                                       |
| `ENABLE_STYLEGUIDE` | no       | `1` exposes `/{locale}/styleguide` outside `next dev` (e2e on a production build). Keep `0` in production |

## Brand note

Demo/brand artwork is used as supplied by the owner (`design/brand-source/`); product images will be generated placeholders, and the system supports official brand assets (see `docs/ASSETS.md` when it lands in M2b).

## Docs

[Architecture](docs/ARCHITECTURE.md) · [Brand](docs/BRAND.md) · [Security](docs/SECURITY.md) · [ADRs](docs/adr)

## License

MIT. See [LICENSE](LICENSE).
