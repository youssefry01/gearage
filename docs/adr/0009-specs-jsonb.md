# ADR 0009: Category-specific specs as JSONB + SpecDefinition

Status: Accepted
Decision: `Product.specs` JSONB, validated by a Zod schema generated from `SpecDefinition` rows (key, type, unit, filterable, facet config, en/ar labels). GIN index for filtering; expression indexes for hot filters later.
Why not EAV: a join per filter. Why not per-category tables: a migration per new category. Trade-off: integrity is enforced in application code, not the DB.

## Addendum (M2b)

Definitions are attached to the category that owns a product family and inherited by sub-categories through the nearest-ancestor
rule (`resolveSpecDefinitions`). Numeric lists are stored as `STRING_LIST` of integers-as-strings. See ADR 0015.
