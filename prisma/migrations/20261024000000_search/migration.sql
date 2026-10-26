-- M4a: search (ADR 0019).
--
-- HAND-WRITTEN. The Prisma schema engine cannot be downloaded in the sandbox this was written in, so this file was NOT
-- produced by `prisma migrate dev`. It follows Prisma's DDL and naming conventions so the schema should show no drift.
-- VERIFY LOCALLY (see README "Verifying a hand-written migration"):
--     npx prisma migrate dev
--     npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code     (0 = identical)
--
-- Sections: 1 text functions (twins of src/domain/search-normalize.ts), 2 tables (Prisma-modelled), 3 indexes,
-- 4 foreign keys, then objects Prisma does not model and does not drop: 5 CHECK constraints, 6 the vocabulary's
-- expression index, 7 document builder and refresh functions, 8 triggers that keep the index current, 9 backfill.
-- Compatible with PostgreSQL 15+. Needs pg_trgm (created by the baseline migration).

-- 1. Text functions -----------------------------------------------------------------------------------------------
-- IMMUTABLE so they can back an index. The regular expressions use \uXXXX escapes (supported by PostgreSQL's regex
-- engine in every encoding) and the bodies are dollar-quoted, so backslashes are literal.

-- Canonical form for matching. MUST stay identical to normalizeSearchText() (a database test compares them):
-- lower-case; alef forms -> alef, alef maksura -> ya, ta marbuta -> ha, hamza on waw/ya -> waw/ya; Arabic-Indic and
-- Persian digits -> 0-9; tashkeel and tatweel removed; Arabic and Latin/digits separated; every other character
-- becomes a space; the "ال" prefix stripped from words with at least three more letters; spaces collapsed.
CREATE FUNCTION "search_normalize"(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT btrim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              translate(lower(input), 'أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', 'اااايهوي01234567890123456789'),
              '[\u064B-\u065F\u0670\u0640]', '', 'g'),
            '([\u0621-\u064A])([a-z0-9])', '\1 \2', 'g'),
          '([a-z0-9])([\u0621-\u064A])', '\1 \2', 'g'),
        '[^a-z0-9\u0621-\u064A]+', ' ', 'g'),
      '(^| )ال(?=[\u0621-\u064A]{3})', '\1', 'g'),
    ' +', ' ', 'g'))
$$;

-- "rtx4060" -> "rtx 4060". Twin of splitMixed().
CREATE FUNCTION "search_split_mixed"(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT regexp_replace(
    regexp_replace(input, '([a-z])([0-9])', '\1 \2', 'g'),
    '([0-9])([a-z])', '\1 \2', 'g')
$$;

-- What the index stores for a text: the normalized words plus their letter/digit-split forms. Twin of foldForIndex().
CREATE FUNCTION "search_fold"(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT CASE WHEN search_split_mixed(n) = n THEN n ELSE n || ' ' || search_split_mixed(n) END
  FROM (SELECT search_normalize(input) AS n) x
$$;

-- Arabic letters mapped one-to-one to ASCII, so trigram similarity works in any database locale (pg_trgm sees no
-- Arabic words under a plain "C" locale). Twin of asciiKey().
CREATE FUNCTION "search_ascii_key"(word text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT translate(word, 'ءابتثجحخدذرزسشصضطظعغفقكلمنهوي', 'abcdefghijklmnopqrstuvwxyz012')
$$;

-- 2. Tables --------------------------------------------------------------------------------------------------------
-- One search document per non-deleted product. Visibility (ACTIVE, active category/brand) is applied at query time
-- through the shared VISIBLE_PRODUCT rule, so a status change never needs a reindex.
CREATE TABLE "product_search" (
    "productId" UUID NOT NULL,
    "vector" tsvector NOT NULL,
    "titleFold" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_search_pkey" PRIMARY KEY ("productId")
);

-- Every searchable word of the catalog (letters only, 3+ characters), for typo correction.
CREATE TABLE "search_vocab" (
    "word" TEXT NOT NULL,
    "freq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "search_vocab_pkey" PRIMARY KEY ("word")
);

-- Searches that found nothing, per day (zero-result analytics). No user, session or IP is stored.
CREATE TABLE "search_zero_result" (
    "day" DATE NOT NULL,
    "term" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "lastAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_zero_result_pkey" PRIMARY KEY ("day","term")
);

-- 3. Indexes -------------------------------------------------------------------------------------------------------
CREATE INDEX "product_search_vector_idx" ON "product_search" USING GIN ("vector");
CREATE INDEX "search_zero_result_day_idx" ON "search_zero_result"("day");

-- 4. Foreign keys --------------------------------------------------------------------------------------------------
ALTER TABLE "product_search" ADD CONSTRAINT "product_search_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. CHECK constraints (not modelled by Prisma) ----------------------------------------------------------------------
ALTER TABLE "search_vocab" ADD CONSTRAINT "search_vocab_word_chk" CHECK (char_length("word") BETWEEN 3 AND 40);
ALTER TABLE "search_vocab" ADD CONSTRAINT "search_vocab_freq_chk" CHECK ("freq" >= 0);
ALTER TABLE "search_zero_result" ADD CONSTRAINT "search_zero_result_term_chk" CHECK (char_length("term") BETWEEN 2 AND 100);
ALTER TABLE "search_zero_result" ADD CONSTRAINT "search_zero_result_count_chk" CHECK ("count" >= 1);

-- 6. Expression index (Prisma does not model expression indexes and does not drop them) ------------------------------
CREATE INDEX "search_vocab_key_trgm_idx" ON "search_vocab" USING GIN ((search_ascii_key("word")) gin_trgm_ops);

-- 7. Document builder and refresh ----------------------------------------------------------------------------------
-- Weights: A title, brand, model, part numbers, SKU; B category names (own and ancestors) and tags; C short
-- descriptions; D spec text values and, for a bundle, its components' brand and model.
CREATE FUNCTION "search_build_vector"(p_id uuid) RETURNS tsvector
LANGUAGE sql STABLE AS $$
  SELECT
    setweight(to_tsvector('simple', search_fold(concat_ws(' ',
      p."titleEn", p."titleAr", b."nameEn", b."nameAr", p."modelName", p."mpn", p."sku"))), 'A') ||
    setweight(to_tsvector('simple', search_fold(concat_ws(' ',
      (SELECT string_agg(c2."nameEn" || ' ' || c2."nameAr", ' ')
         FROM "category" c2 WHERE cat."path" = c2."path" OR cat."path" LIKE c2."path" || '/%'),
      (SELECT string_agg(t."nameEn" || ' ' || t."nameAr", ' ')
         FROM "product_tag" pt JOIN "tag" t ON t."id" = pt."tagId" WHERE pt."productId" = p."id")))), 'B') ||
    setweight(to_tsvector('simple', search_fold(concat_ws(' ',
      p."shortDescriptionEn", p."shortDescriptionAr"))), 'C') ||
    setweight(to_tsvector('simple', search_fold(concat_ws(' ',
      (SELECT string_agg(s.v, ' ') FROM (
         SELECT e.value #>> '{}' AS v FROM jsonb_each(p."specs") e WHERE jsonb_typeof(e.value) = 'string'
         UNION ALL
         SELECT a.value #>> '{}' FROM jsonb_each(p."specs") e,
           jsonb_array_elements(CASE WHEN jsonb_typeof(e.value) = 'array' THEN e.value ELSE '[]'::jsonb END) a
         WHERE jsonb_typeof(a.value) = 'string') s),
      -- A bundle is found by its parts' brand and model ("rtx 4060"), not by their generic type words, which would
      -- make every bundle a "graphics card" or a "processor" search result.
      (SELECT string_agg(concat_ws(' ', cb."nameEn", cb."nameAr", comp."modelName"), ' ')
         FROM "bundle_item" bi JOIN "product" comp ON comp."id" = bi."componentId"
         LEFT JOIN "brand" cb ON cb."id" = comp."brandId"
         WHERE bi."bundleId" = p."id")))), 'D')
  FROM "product" p
  JOIN "category" cat ON cat."id" = p."categoryId"
  LEFT JOIN "brand" b ON b."id" = p."brandId"
  WHERE p."id" = p_id
$$;

-- Rebuilds the documents of the given products (all non-deleted products when NULL) and adds their words to the
-- vocabulary. Called by the triggers below, by the seed (through them), and by the nightly job.
CREATE FUNCTION "refresh_product_search"(p_ids uuid[]) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "product_search" ("productId", "vector", "titleFold", "updatedAt")
  SELECT p."id", search_build_vector(p."id"),
         search_fold(concat_ws(' ', p."titleEn", p."titleAr")), timezone('UTC', now())
  FROM "product" p
  WHERE p."deletedAt" IS NULL AND (p_ids IS NULL OR p."id" = ANY(p_ids))
  ON CONFLICT ("productId") DO UPDATE
    SET "vector" = EXCLUDED."vector", "titleFold" = EXCLUDED."titleFold", "updatedAt" = EXCLUDED."updatedAt";

  DELETE FROM "product_search" ps USING "product" p
  WHERE ps."productId" = p."id" AND p."deletedAt" IS NOT NULL AND (p_ids IS NULL OR p."id" = ANY(p_ids));

  INSERT INTO "search_vocab" ("word", "freq")
  SELECT DISTINCT w, 0
  FROM (SELECT unnest(tsvector_to_array(ps."vector")) AS w FROM "product_search" ps
        WHERE p_ids IS NULL OR ps."productId" = ANY(p_ids)) x
  WHERE w ~ '^[a-z]{3,40}$' OR w ~ '^[\u0621-\u064A]{3,40}$'
  ON CONFLICT ("word") DO NOTHING;
END $$;

-- Recomputes every word's document frequency and drops words no document contains any more.
CREATE FUNCTION "rebuild_search_vocab"() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  WITH counts AS (
    SELECT w AS word, count(*)::int AS n
    FROM (SELECT unnest(tsvector_to_array(ps."vector")) AS w FROM "product_search" ps) x
    WHERE w ~ '^[a-z]{3,40}$' OR w ~ '^[\u0621-\u064A]{3,40}$'
    GROUP BY w),
  upserted AS (
    INSERT INTO "search_vocab" ("word", "freq") SELECT word, n FROM counts
    ON CONFLICT ("word") DO UPDATE SET "freq" = EXCLUDED."freq"
    RETURNING 1)
  DELETE FROM "search_vocab" v WHERE NOT EXISTS (SELECT 1 FROM counts c WHERE c.word = v."word");
END $$;

-- 8. Triggers: the index follows the catalog inside the same transaction --------------------------------------------
-- A product's document depends on its own text, brand, category chain, tags, specs and (bundles) component titles.
CREATE FUNCTION "fn_search_product"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_product_search(ARRAY[NEW."id"] ||
    COALESCE((SELECT array_agg(bi."bundleId") FROM "bundle_item" bi WHERE bi."componentId" = NEW."id"), '{}'::uuid[]));
  RETURN NULL;
END $$;

CREATE TRIGGER "trg_search_product_insert" AFTER INSERT ON "product"
  FOR EACH ROW EXECUTE FUNCTION "fn_search_product"();
CREATE TRIGGER "trg_search_product_update" AFTER UPDATE OF "titleEn", "titleAr", "shortDescriptionEn", "shortDescriptionAr",
  "modelName", "mpn", "sku", "brandId", "categoryId", "specs", "deletedAt" ON "product"
  FOR EACH ROW EXECUTE FUNCTION "fn_search_product"();

CREATE FUNCTION "fn_search_product_tag"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_product_search(ARRAY[COALESCE(NEW."productId", OLD."productId")]);
  RETURN NULL;
END $$;
CREATE TRIGGER "trg_search_product_tag" AFTER INSERT OR UPDATE OR DELETE ON "product_tag"
  FOR EACH ROW EXECUTE FUNCTION "fn_search_product_tag"();

CREATE FUNCTION "fn_search_bundle_item"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_product_search(ARRAY[COALESCE(NEW."bundleId", OLD."bundleId")]);
  RETURN NULL;
END $$;
CREATE TRIGGER "trg_search_bundle_item" AFTER INSERT OR UPDATE OR DELETE ON "bundle_item"
  FOR EACH ROW EXECUTE FUNCTION "fn_search_bundle_item"();

CREATE FUNCTION "fn_search_brand"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_product_search(COALESCE(
    (SELECT array_agg(p."id") FROM "product" p WHERE p."brandId" = NEW."id"), '{}'::uuid[]));
  RETURN NULL;
END $$;
CREATE TRIGGER "trg_search_brand" AFTER UPDATE OF "nameEn", "nameAr" ON "brand"
  FOR EACH ROW EXECUTE FUNCTION "fn_search_brand"();

CREATE FUNCTION "fn_search_category"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_product_search(COALESCE(
    (SELECT array_agg(p."id") FROM "product" p JOIN "category" c ON c."id" = p."categoryId"
      WHERE c."path" = NEW."path" OR c."path" LIKE NEW."path" || '/%'), '{}'::uuid[]));
  RETURN NULL;
END $$;
CREATE TRIGGER "trg_search_category" AFTER UPDATE OF "nameEn", "nameAr", "path" ON "category"
  FOR EACH ROW EXECUTE FUNCTION "fn_search_category"();

CREATE FUNCTION "fn_search_tag"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_product_search(COALESCE(
    (SELECT array_agg(pt."productId") FROM "product_tag" pt WHERE pt."tagId" = NEW."id"), '{}'::uuid[]));
  RETURN NULL;
END $$;
CREATE TRIGGER "trg_search_tag" AFTER UPDATE OF "nameEn", "nameAr" ON "tag"
  FOR EACH ROW EXECUTE FUNCTION "fn_search_tag"();

-- 9. Backfill: index whatever already exists (a no-op on a fresh database) ---------------------------------------------
SELECT refresh_product_search(NULL);
SELECT rebuild_search_vocab();
