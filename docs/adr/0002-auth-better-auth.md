# ADR 0002: Better Auth

Status: Accepted
Decision: Better Auth with the Prisma adapter, httpOnly cookie sessions, email OTP and 2FA plugins. Our own `getSession()` wrapper isolates it.
Why: In Sept 2025 the Auth.js team joined Better Auth; Auth.js is now security-patch-only and its maintainers recommend Better Auth for new projects. Users live in our own Postgres.
Trade-off: Younger library; mitigated by the wrapper and tests on our own auth flows.
Guest checkout is not supported: checkout needs a verified-email account. Guest carts merge on login.
