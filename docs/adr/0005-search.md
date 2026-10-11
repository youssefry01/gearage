# ADR 0005: Postgres FTS + pg_trgm

Status: Accepted
Decision: A `search_document` per product and locale with Arabic normalization (tashkeel, alef/ya/ta-marbuta variants) done in one SQL function; `tsvector` with the `simple` config plus trigram GIN index. Suggestions via prefix + trigram similarity. Behind a `SearchProvider` interface.
Why: Zero extra infrastructure, good enough for tens of thousands of SKUs. Replace with Meilisearch/Typesense behind the interface if needed.
Note: Prisma cannot express these indexes; they live in raw SQL migrations with typed raw queries.
