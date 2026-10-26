# ADR 0005: Postgres FTS + pg_trgm

Status: Accepted. Refined by [ADR 0019](0019-search.md) (M4a): one document per product with both languages, a trigram index on an ASCII key, synonyms and typo tiers, triggers instead of application-side indexing.
Decision: A `search_document` per product and locale with Arabic normalization (tashkeel, alef/ya/ta-marbuta variants) done in one SQL function; `tsvector` with the `simple` config plus trigram GIN index. Suggestions via prefix + trigram similarity. Behind a `SearchProvider` interface.
Why: Zero extra infrastructure, good enough for tens of thousands of SKUs. Replace with Meilisearch/Typesense behind the interface if needed.
Note: Prisma cannot express these indexes; they live in raw SQL migrations with typed raw queries.
