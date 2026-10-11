# ADR 0001: One Next.js modular monolith

Status: Accepted (2026-10-09)
Decision: Single Next.js App Router project (Server Components, Route Handlers, Server Actions). Business logic in `server/services`, pure rules in `domain/`, Prisma only in repositories. Layering is enforced by ESLint import rules.
Why: One deploy, shared Zod types, no network hop, fits free tiers. A separate Node framework adds ops cost with no benefit at this scale.
Revisit if: websockets or long-running jobs are needed; then add a worker (e.g. Render free tier) that reuses `domain/` and `server/`.
