# ADR 0011: Dependency pinning and security overrides

Status: Accepted (2026-10-09)
Decision: All runtime and tooling dependencies are pinned to exact versions (verified against the npm registry on 2026-10-09). Dependabot proposes weekly grouped minor/patch updates.
Deliberate pins below "latest":

- `typescript` 6.0.3, not 7.0.x: `typescript-eslint` 8.71 declares support for TypeScript below 6.1. Revisit when typescript-eslint supports 7.
- `prisma` + `@prisma/client` + `@prisma/adapter-pg` 7.10.0, not `prisma@latest`: the `latest` tag of the CLI currently points at an 8.0 release candidate. Move to 8.x when it is stable.
- `@types/node` 22.x to match the Node 22 runtime (`engines.node >= 22.12`).
  Overrides: `mysql2` 3.24.5 and `deepmerge-ts` 8.0.2 are forced because `npm audit` reported 4 high advisories in transitive dependencies of the Prisma CLI (we never use MySQL; the CLI bundles the driver). Prisma validate/generate were re-verified with the overrides. Remove the overrides once Prisma ships patched ranges.
  Policy: `npm audit --omit=dev --audit-level=high` is a blocking CI step.
