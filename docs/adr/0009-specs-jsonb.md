# ADR 0009: Category-specific specs as JSONB + SpecDefinition

Status: Accepted
Decision: `Product.specs` JSONB, validated by a Zod schema generated from `SpecDefinition` rows (key, type, unit, filterable, facet config, en/ar labels). GIN index for filtering; expression indexes for hot filters later.
Why not EAV: a join per filter. Why not per-category tables: a migration per new category. Trade-off: integrity is enforced in application code, not the DB.
