# ADR 0003: Argon2id password hashing

Status: Accepted (parameters to be benchmarked in M5a)
Decision: Argon2id via `@node-rs/argon2`; target m=64 MiB, t=3, p=1, 32-byte output, unique random salt per hash, server-side pepper passed as the Argon2 secret. Better Auth's default scrypt is overridden. Rehash on login when parameters change (parse PHC string). Node runtime only.
Policy: min 12 chars, HIBP k-anonymity breach check, no composition rules.
Floor: OWASP minimum is m=19 MiB, t=2, p=1; we never go below it.
