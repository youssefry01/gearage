# ADR 0013: Server-side structure inside Next.js (actions, handlers, public API)

Status: Accepted (2026-10-11). Decided before M2a, as requested.

## Context

No separate backend (ADR 0001). The question is what, inside the Next.js server, receives requests and calls the service layer
(`server/services`, which holds all business rules and stays framework-free). Three surfaces exist:

1. **Our own UI mutating data** (register, address book, cart merge, checkout, reviews, admin CRUD): Server Actions.
2. **Machine callers** (payment webhooks with raw-body HMAC, cron, health/status, OG images): Route Handlers.
3. **A possible future public API** (mobile app, partner/marketplace feeds, third-party integrations): not required today.

Every mutation must validate input (Zod), authorize, map errors to one format, and be rate limited and audited. A Server Action is
a public POST endpoint, so "forgot the auth check" is the main failure mode to design against.

## Options compared

| Criterion                          | A. Plain Route Handlers + Server Actions             | B. next-safe-action (Server Actions)                                             | C. Hono in a catch-all Route Handler                                                         |
| ---------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| What it is                         | Next primitives, hand-written checks                 | Typed, chainable action client with middleware                                   | Small web-standards router + validators, mounted at `/api/v1/[[...route]]` via `hono/vercel` |
| Validation (Zod 4)                 | Manual `safeParse` in every action                   | Built in (Standard Schema; Zod 4 works), typed `parsedInput`, field errors       | `@hono/zod-validator` / `@hono/zod-openapi` (Zod 4 supported)                                |
| Auth + authorization in every call | Convention only; easy to forget                      | Enforced by construction: `authedAction`, `adminAction` clients with typed `ctx` | Middleware per route group                                                                   |
| Error format                       | We write the mapper once and must call it everywhere | One `handleServerError` hook maps `AppError` to the envelope                     | `app.onError`                                                                                |
| Rate limit / audit / logging       | Hand-wired per action                                | Middleware (add once per client)                                                 | Middleware                                                                                   |
| Forms (React Hook Form)            | Manual wiring                                        | Official RHF adapter, `useAction` hooks, progressive enhancement                 | Not for our own forms (calls go through fetch)                                               |
| Public API features                | None                                                 | None (actions are not a stable API)                                              | Strong: OpenAPI generation, typed RPC client, versioned routes                               |
| Raw body (webhook HMAC)            | Fine                                                 | Not applicable                                                                   | Fine, but pointless for one route                                                            |
| New dependency surface             | None                                                 | One small library (+ RHF adapter)                                                | Hono + validator/openapi packages                                                            |
| Fit today                          | Works, relies on discipline                          | Best fit for surface 1                                                           | Solves surface 3, which does not exist yet                                                   |
| Cost to swap out later             | n/a                                                  | Low if confined (see boundaries)                                                 | Low if confined                                                                              |

Facts verified 2026-10-11: next-safe-action v8 (Standard Schema, typed middleware context, RHF adapter, Better Auth guide, needs Next >= 14 and React >= 18.2);
Hono mounts in Next with `hono/vercel` and an optional catch-all route; `@hono/zod-openapi` supports Zod 4.

## Decision

- **Adopt next-safe-action for Server Actions** (surface 1), created in M5a together with auth, because that is when the first real mutations appear.
  Two base clients: `publicAction` (rate limit, logging, error mapping) and `authedAction`/`adminAction` (adds session lookup, role check, audit context).
  An action file contains no business logic: validate (declared once on the client), call one service function, return.
- **Keep plain Route Handlers** for surface 2 (webhooks, cron, health, status, OG). They already use `handle()` and the response envelope.
- **Do NOT adopt Hono now** (surface 3). Revisit only when a concrete public/partner/mobile API is required. When it is, it mounts at
  `/api/v1/[[...route]]` (so it never shadows `/api/health`, `/api/cron`, `/api/status`), reuses the same services and the same Zod schemas from `domain/`,
  and gets OpenAPI for free. Until then it would be unused code and an unused attack surface.

## Boundaries that keep it swappable

1. **Services never import a framework**: no `next-safe-action`, `hono`, `next/*` in `server/services`, `server/repositories` or `domain/`.
   Services take plain arguments plus an `Actor` (`{ userId, role } | null`) and throw `AppError`.
2. **Zod schemas live in `domain/`** (shared with React Hook Form on the client). The action layer references them; it does not define them.
3. **One import site**: `next-safe-action` is imported only by `src/server/actions/client.ts` (the base clients) and by `*.actions.ts` files under `src/features/*/`.
   ESLint `no-restricted-imports` enforces this when the library is added (M5a). Same rule for `hono` if it is ever adopted.
4. **Swap cost**: replacing the library means rewriting the thin `*.actions.ts` wrappers and `client.ts`. Services, schemas, tests and UI forms' schemas are untouched.
   A hand-written `action()` wrapper (about 60 lines: parse, auth, try/catch, envelope) is the fallback if the library is ever abandoned.

## Consequences

- Authorization cannot be forgotten silently: an action is built from a client that already requires the right role.
- One more dependency to track (weekly Dependabot, `npm audit` gate already in CI). Its API surface we use is small.
- Public API is deferred, with a documented, collision-free mount point and a no-rewrite path.

## Revisit when

A partner/mobile/marketplace API is requested (adopt C for that surface only); next-safe-action stops being maintained or lags Next/React majors (use the in-house wrapper); or Next ships a first-party validated-action primitive.
