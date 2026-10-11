# Gearage

Production-grade PC hardware e-commerce platform for Egypt: EGP pricing, Cash on Delivery, English and Arabic (RTL), PC bundles.

> Status: **M0 foundations**. The storefront is not built yet. See [HANDOFF.md](HANDOFF.md) for status and the roadmap.

<!-- Screenshots / GIFs arrive with the storefront milestones. -->

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · PostgreSQL 17 + Prisma 7 · Zod 4 · Vitest + Testing Library · Playwright. Reasons live in [docs/adr](docs/adr).

## Local setup

Requirements: Node >= 22.12, Docker.

```bash
git init                      # once, so Husky hooks install (skip if already a repo)
cp .env.example .env          # then set CRON_SECRET (openssl rand -base64 48)
npm install                   # also runs `prisma generate`
docker compose up -d          # Postgres 17 on :5432
npx prisma migrate dev        # applies the baseline migration
npm run dev                   # http://localhost:3000
```

Check: `curl localhost:3000/api/health` and `curl localhost:3000/api/health/ready`.

## Scripts

| Script                                                         | Purpose                                                   |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| `npm run dev` / `build` / `start`                              | Next.js                                                   |
| `npm run lint` / `typecheck`                                   | ESLint (incl. layering rules) / `tsc`                     |
| `npm test`                                                     | Vitest unit and component tests                           |
| `npm run test:e2e`                                             | Playwright (needs `npx playwright install chromium` once) |
| `npm run format` / `format:check`                              | Prettier                                                  |
| `npm run db:migrate` / `db:deploy` / `db:validate` / `db:seed` | Prisma                                                    |

## Environment variables

| Variable       | Required | Purpose                                                  |
| -------------- | -------- | -------------------------------------------------------- |
| `DATABASE_URL` | yes      | Runtime Postgres URL (pooled in production)              |
| `DIRECT_URL`   | no       | Direct URL for migrations (falls back to `DATABASE_URL`) |
| `CRON_SECRET`  | yes      | Bearer secret for `/api/cron/*`, min 32 chars            |
| `APP_URL`      | no       | Public base URL (default `http://localhost:3000`)        |
| `LOG_LEVEL`    | no       | `debug` / `info` / `warn` / `error`                      |

## Docs

[Architecture](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md) · [ADRs](docs/adr)

## License

MIT. See [LICENSE](LICENSE).
