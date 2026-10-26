import { Prisma } from "@/generated/prisma/client";
import type { VocabCandidate } from "@/domain/search";
import { getDb } from "@/server/db";

type Db = ReturnType<typeof getDb>;

export type TokenLookup = {
  token: string;
  /** Some vocabulary word starts with the token: it is a real (maybe partial) word, so it is not a typo. */
  known: boolean;
  candidates: VocabCandidate[];
};

/** Trigram similarity floor for candidate words. Low on purpose: the application re-ranks by edit distance. */
const SIMILARITY_FLOOR = 0.2;
const CANDIDATES_PER_TOKEN = 8;

/**
 * For each token: is it a known word (prefix of a vocabulary word), and which vocabulary words are similar to it.
 * ONE statement for all tokens. Similarity is computed on `search_ascii_key`, which makes Arabic work in any database
 * locale (see the migration). The threshold is set with `set_config(..., true)` inside a transaction, so it applies
 * to this statement only and survives a transaction-mode pooler (Supabase pgbouncer).
 */
export async function lookupVocabulary(
  tokens: readonly string[],
  db: Db = getDb(),
): Promise<TokenLookup[]> {
  if (tokens.length === 0) return [];
  type Row = { token: string; known: boolean; word: string | null; freq: number | null };
  const rows = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('pg_trgm.similarity_threshold', ${String(SIMILARITY_FLOOR)}, true)`;
    return tx.$queryRaw<Row[]>(Prisma.sql`
      SELECT t.token,
             EXISTS (SELECT 1 FROM "search_vocab" k WHERE starts_with(k."word", t.token)) AS "known",
             c."word", c."freq"
      FROM unnest(${[...tokens]}::text[]) AS t(token)
      LEFT JOIN LATERAL (
        SELECT v."word", v."freq" FROM "search_vocab" v
        WHERE search_ascii_key(v."word") % search_ascii_key(t.token)
        ORDER BY similarity(search_ascii_key(v."word"), search_ascii_key(t.token)) DESC, v."freq" DESC, v."word"
        LIMIT ${CANDIDATES_PER_TOKEN}
      ) c ON TRUE`);
  });
  const byToken = new Map<string, TokenLookup>();
  for (const r of rows) {
    const entry = byToken.get(r.token) ?? { token: r.token, known: r.known, candidates: [] };
    if (r.word !== null) entry.candidates.push({ word: r.word, freq: r.freq ?? 0 });
    byToken.set(r.token, entry);
  }
  return [...byToken.values()];
}

/** Daily cap on distinct zero-result terms: a bot typing random words cannot grow the table without bound. */
export const ZERO_RESULT_DAILY_CAP = 5000;

/**
 * Counts one zero-result search (one row per day and term). A new term is ignored once the day's cap is reached; a
 * term already stored today keeps counting. `day` is a UTC date ("2026-10-25"), `now` a UTC instant.
 */
export async function recordZeroResult(term: string, now: Date, db: Db = getDb()): Promise<void> {
  const day = now.toISOString().slice(0, 10);
  const at = now.toISOString().slice(0, 23);
  await db.$executeRaw`
    INSERT INTO "search_zero_result" ("day", "term", "count", "lastAt")
    SELECT ${day}::date, ${term}, 1, ${at}::timestamp
    WHERE (SELECT COUNT(*) FROM "search_zero_result" WHERE "day" = ${day}::date) < ${ZERO_RESULT_DAILY_CAP}
       OR EXISTS (SELECT 1 FROM "search_zero_result" WHERE "day" = ${day}::date AND "term" = ${term})
    ON CONFLICT ("day", "term") DO UPDATE
      SET "count" = "search_zero_result"."count" + 1, "lastAt" = EXCLUDED."lastAt"`;
}

export type ZeroResultRow = { term: string; count: number };

/** The most frequent zero-result terms since a UTC day (for the admin overview in a later milestone, and tests). */
export async function topZeroResults(
  sinceDay: string,
  limit: number,
  db: Db = getDb(),
): Promise<ZeroResultRow[]> {
  return db.$queryRaw<ZeroResultRow[]>`
    SELECT "term", SUM("count")::int AS "count" FROM "search_zero_result"
    WHERE "day" >= ${sinceDay}::date GROUP BY "term" ORDER BY SUM("count") DESC, "term" LIMIT ${limit}`;
}

/** Deletes zero-result rows older than the given UTC day. Returns how many. */
export async function pruneZeroResults(beforeDay: string, db: Db = getDb()): Promise<number> {
  return db.$executeRaw`DELETE FROM "search_zero_result" WHERE "day" < ${beforeDay}::date`;
}

/** Rebuilds every document and the vocabulary (the nightly safety net; the triggers do the day-to-day work). */
export async function rebuildSearchIndex(db: Db = getDb()): Promise<void> {
  await db.$executeRaw`SELECT refresh_product_search(NULL)`;
  await db.$executeRaw`SELECT rebuild_search_vocab()`;
}

export type ActiveBrand = { slug: string; nameEn: string; nameAr: string | null };

/** Active brands that have at least one visible product (for the suggestion dropdown). */
export async function fetchSearchableBrands(db: Db = getDb()): Promise<ActiveBrand[]> {
  return db.$queryRaw<ActiveBrand[]>`
    SELECT b."slug", b."nameEn", b."nameAr" FROM "brand" b
    WHERE b."isActive" AND EXISTS (
      SELECT 1 FROM "product" p JOIN "category" c ON c."id" = p."categoryId"
      WHERE p."brandId" = b."id" AND p."status" = 'ACTIVE' AND p."deletedAt" IS NULL AND c."isActive")
    ORDER BY b."nameEn"`;
}
