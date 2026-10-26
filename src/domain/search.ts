import {
  ARABIC_RANGE,
  PREFIX_MIN_LENGTH,
  SEARCH_MAX_CHARS,
  SEARCH_MAX_TERMS,
  SEARCH_MIN_CHARS,
  cleanQueryInput,
  normalizeSearchText,
  splitMixed,
} from "@/domain/search-normalize";
import { SYNONYM_INDEX, SYNONYM_MAX_TOKENS } from "@/domain/search-synonyms";

/**
 * Query parsing, tsquery building and typo correction (ADR 0019). Pure, so it is tested without a database.
 * Normalization itself lives in search-normalize.ts.
 */
const MAX_TOKEN_LENGTH = 40;

/** Words that carry no product meaning ("best", "for", "inch"): dropped unless nothing else is left. */
const STOP_WORDS: ReadonlySet<string> = new Set(
  [
    "a",
    "an",
    "the",
    "for",
    "with",
    "and",
    "of",
    "to",
    "in",
    "on",
    "inch",
    "inches",
    "best",
    "cheap",
    "cheapest",
    "good",
    "buy",
    "price",
    "new",
    "بوصة",
    "في",
    "من",
    "مع",
    "و",
    "على",
    "افضل",
    "احسن",
    "ارخص",
    "رخيص",
    "سعر",
    "شراء",
    "جديد",
  ].map(normalizeSearchText),
);

/** One way to say a term: every token must match (AND). */
export type Alternative = readonly string[];
/** One thing the shopper asked for. Any alternative satisfies it (OR): the original wording, synonyms, split forms. */
export type Term = {
  source: string;
  alternatives: readonly Alternative[];
  /**
   * Set when the term is a synonym group: only the alternative the shopper typed (`literal`) may match anywhere in a
   * product's text. The other members are looked up in title, brand, category and tags only, so "كارت شاشة" does not
   * match a case whose description happens to say "graphics cards".
   */
  synonym?: { literal: number };
};
export type ParsedQuery = {
  /** The cleaned text the shopper typed. */
  input: string;
  normalized: string;
  tokens: string[];
  terms: Term[];
};

const hasLetterAndDigit = (t: string): boolean => /[a-z]/.test(t) && /[0-9]/.test(t);

function plainTerm(token: string): Term {
  const alternatives: Alternative[] = [[token]];
  if (hasLetterAndDigit(token)) {
    const parts = splitMixed(token).split(" ");
    // Only when every letter group is a real word-like piece: "rtx4060" -> rtx + 4060, but "i5" and "14600k" stay
    // whole (their one-letter parts would match almost anything).
    const wordLike = parts.every((part) => /^[0-9]+$/.test(part) || part.length >= 2);
    if (parts.length > 1 && wordLike) alternatives.push(parts);
  }
  return { source: token, alternatives };
}

/**
 * Turns what the shopper typed into terms. Synonym phrases (up to SYNONYM_MAX_TOKENS words, longest first) become one
 * term with every member of their group as an alternative; model numbers written together or apart ("rtx4060",
 * "rtx 4060") get both forms; stop words are dropped.
 */
export function parseSearchQuery(raw: string): ParsedQuery {
  const input = cleanQueryInput(raw);
  const normalized = normalizeSearchText(input);
  const tokens = normalized === "" ? [] : normalized.split(" ").slice(0, SEARCH_MAX_TERMS * 2);
  const meaningful = tokens.filter((t) => !STOP_WORDS.has(t));
  const words = meaningful.length > 0 ? meaningful : tokens;

  const terms: Term[] = [];
  let i = 0;
  while (i < words.length && terms.length < SEARCH_MAX_TERMS) {
    let matched = false;
    for (let len = Math.min(SYNONYM_MAX_TOKENS, words.length - i); len >= 1; len--) {
      const phrase = words.slice(i, i + len).join(" ");
      const group = SYNONYM_INDEX.get(phrase);
      if (group) {
        terms.push({
          source: phrase,
          alternatives: group.members.map((m) => m.split(" ")),
          synonym: { literal: group.members.indexOf(phrase) },
        });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const token = words[i] as string;
      if (token.length <= MAX_TOKEN_LENGTH) terms.push(plainTerm(token));
      i += 1;
    }
  }
  return { input, normalized, tokens, terms };
}

const LEXEME = /^[a-z0-9\u0621-\u064A]{1,40}$/;

/** Weights A and B: title, brand, model, SKU, categories, tags (see the migration's search_build_vector). */
const TITLE_WEIGHTS = "AB";

function lexeme(token: string, weights?: string): string {
  // Defense in depth: normalization already guarantees this alphabet, so nothing can reach to_tsquery's syntax.
  if (!LEXEME.test(token)) throw new Error(`Unsafe search token: ${JSON.stringify(token)}`);
  const prefix = token.length >= PREFIX_MIN_LENGTH ? "*" : "";
  return `${token}:${prefix}${weights ?? ""}`.replace(/:$/, "");
}

/** The tokens of an alternative are a phrase: adjacent and in order ("2" then "tb", not "M.2 ... 1TB"). */
const alternativeText = (alt: Alternative, weights?: string): string =>
  `(${alt.map((t) => lexeme(t, weights)).join(" <-> ")})`;
const termText = (term: Term): string =>
  `(${term.alternatives
    .map((alt, i) =>
      alternativeText(alt, term.synonym && i !== term.synonym.literal ? TITLE_WEIGHTS : undefined),
    )
    .join(" | ")})`;

/**
 * The `to_tsquery('simple', ...)` text. "all": every term must match (the normal case); "any": at least one term
 * (the last-resort partial match). null when there is nothing to search for.
 */
export function toTsQueryText(parsed: ParsedQuery, mode: "all" | "any" = "all"): string | null {
  if (parsed.terms.length === 0) return null;
  return parsed.terms.map(termText).join(mode === "all" ? " & " : " | ");
}

const hasDigit = (term: Term): boolean =>
  term.alternatives.some((alt) => alt.some((t) => /[0-9]/.test(t)));

/**
 * The last-resort partial match: products matching at least one WORD of the query. A model number alone never
 * qualifies a product ("gtx 1080" must not return everything that mentions "1080p"), but it still ranks products that
 * have it higher. null when the query has no word term (nothing sensible to relax).
 */
export function toPartialTsQueryTexts(
  parsed: ParsedQuery,
): { match: string; rank: string; terms: string[] } | null {
  const words = parsed.terms.filter((t) => !hasDigit(t));
  if (words.length === 0) return null;
  return {
    match: words.map(termText).join(" | "),
    rank: parsed.terms.map(termText).join(" | "),
    // One tsquery per term, so ranking can put products matching MORE of the words first.
    terms: parsed.terms.map(termText),
  };
}

/** True when the search box holds something searchable (at least two characters after normalization). */
export const isSearchable = (parsed: ParsedQuery): boolean =>
  parsed.terms.length > 0 && parsed.normalized.length >= SEARCH_MIN_CHARS;

// ---------------------------------------------------------------------------------------------------------------
// Typo correction. Only words are corrected, never model numbers: "4060" and "4070" are different products, so a
// token containing a digit is left alone. The database proposes candidates (trigram similarity on the vocabulary);
// this module chooses.
// ---------------------------------------------------------------------------------------------------------------

export const CORRECTION_MIN_LENGTH = 4;

/** A word we may try to correct: letters only (Latin or Arabic), long enough that a typo is likely. */
export const isCorrectable = (token: string): boolean =>
  token.length >= CORRECTION_MIN_LENGTH &&
  (/^[a-z]+$/.test(token) || new RegExp(`^[${ARABIC_RANGE}]+$`).test(token));

/** The plain tokens of a parsed query that could be corrected (synonym matches are already understood). */
export function correctableTokens(parsed: ParsedQuery): string[] {
  const out: string[] = [];
  for (const term of parsed.terms) {
    const only = term.alternatives.length === 1 ? term.alternatives[0] : undefined;
    const token = only && only.length === 1 ? only[0] : undefined;
    if (
      token !== undefined &&
      token === term.source &&
      isCorrectable(token) &&
      !out.includes(token)
    )
      out.push(token);
  }
  return out;
}

/** Optimal string alignment distance: insertions, deletions, substitutions and adjacent swaps each cost 1. */
export function editDistance(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  const d: number[][] = Array.from({ length: x.length + 1 }, (_, i) => [
    i,
    ...new Array<number>(y.length).fill(0),
  ]);
  for (let j = 1; j <= y.length; j++) (d[0] as number[])[j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      const row = d[i] as number[];
      const prev = d[i - 1] as number[];
      row[j] = Math.min(
        (prev[j] as number) + 1,
        (row[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1])
        row[j] = Math.min(row[j] as number, ((d[i - 2] as number[])[j - 2] as number) + 1);
    }
  }
  return (d[x.length] as number[])[y.length] as number;
}

/** How many edits a word of this length may be from a vocabulary word and still count as the same word. */
export const maxEdits = (length: number): number => (length <= 5 ? 1 : length <= 8 ? 2 : 3);

export type VocabCandidate = { word: string; freq: number };

/**
 * Picks the vocabulary word a mistyped token most likely meant: fewest edits (within maxEdits), then the more common
 * word, then the shorter, then alphabetical (so the choice is deterministic). undefined when nothing is close enough.
 */
export function pickCorrection(
  token: string,
  candidates: readonly VocabCandidate[],
): string | undefined {
  const limit = maxEdits(token.length);
  const scored = candidates
    .filter((c) => c.word !== token)
    .map((c) => ({ ...c, distance: editDistance(token, c.word) }))
    .filter((c) => c.distance <= limit)
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        b.freq - a.freq ||
        a.word.length - b.word.length ||
        (a.word < b.word ? -1 : a.word > b.word ? 1 : 0),
    );
  return scored[0]?.word;
}

/** The query with corrected words substituted, ready to parse again. Tokens without a correction stay as typed. */
export function applyCorrections(
  parsed: ParsedQuery,
  corrections: ReadonlyMap<string, string>,
): string {
  return parsed.tokens.map((t) => corrections.get(t) ?? t).join(" ");
}

/**
 * LIKE patterns for the "the title contains what was typed" boost: the words as meant (stop words removed, synonym
 * phrases as typed) in normalized form and in letter/digit-split form, so "rtx4060" boosts titles that say "RTX 4060".
 * Empty when there is nothing to boost on. The alphabet is closed (normalized text), so no LIKE escaping is needed.
 */
export function phrasePatterns(parsed: ParsedQuery): string[] {
  const phrase = parsed.terms.map((t) => t.source).join(" ");
  if (phrase.length < SEARCH_MIN_CHARS) return [];
  return [...new Set([phrase, splitMixed(phrase)])].map((p) => `%${p}%`);
}

/**
 * Does a short text (a category or brand name) satisfy every term? A term is satisfied when one of its alternatives
 * has every token matching a word of the text (as a prefix for tokens of PREFIX_MIN_LENGTH or more, exactly for
 * shorter ones). Used for the suggestion dropdown's category and brand rows, which are matched in memory.
 */
export function termsMatchText(parsed: ParsedQuery, text: string): boolean {
  if (parsed.terms.length === 0) return false;
  const words = normalizeSearchText(text).split(" ").filter(Boolean);
  const hit = (token: string): boolean =>
    words.some((w) => (token.length >= PREFIX_MIN_LENGTH ? w.startsWith(token) : w === token));
  return parsed.terms.every((term) => term.alternatives.some((alt) => alt.every(hit)));
}

/**
 * Whether a zero-result search may be stored for analytics. Shoppers sometimes paste things that are not product
 * searches (an email, a phone number, an order number): anything with an "@", a run of seven or more digits, or nine or more digits in total is
 * never stored. Only the normalized term is kept, never who searched.
 */
export function isLoggableSearchTerm(input: string, normalized: string): boolean {
  if (input.includes("@")) return false;
  // A phone number may be typed with spaces, so the total digit count counts too (model searches stay far below it).
  if (/[0-9]{7,}/.test(normalized) || (normalized.match(/[0-9]/g) ?? []).length >= 9) return false;
  return normalized.length >= SEARCH_MIN_CHARS && normalized.length <= SEARCH_MAX_CHARS;
}

/**
 * Single words of the synonym dictionary, as correction candidates. Arabic spellings of brands ("انفيديا") exist only
 * there, not in any product text, so a typo in one ("انفديا") can only be corrected against this list.
 */
export const SYNONYM_WORDS: readonly VocabCandidate[] = [...SYNONYM_INDEX.keys()]
  .filter((m) => !m.includes(" ") && isCorrectable(m))
  .map((word) => ({ word, freq: 0 }));
