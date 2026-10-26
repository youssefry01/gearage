/**
 * Search normalization (ADR 0019): the leaf module. Pure, and imported by the synonym dictionary and the query parser.
 *
 * Three of these functions have a SQL twin that builds the index (`search_normalize`, `search_fold` and
 * `search_ascii_key` in migration 20261024000000_search). Index and query MUST normalize identically or terms
 * silently stop matching, so a database test compares both implementations on a corpus plus random strings.
 */

export const SEARCH_MAX_CHARS = 100;
export const SEARCH_MAX_TERMS = 8;
export const SEARCH_MIN_CHARS = 2;
/** Tokens shorter than this match exactly; longer ones match as prefixes ("rtx" finds "rtx4060"). */
export const PREFIX_MIN_LENGTH = 3;

export const ARABIC_RANGE = "\\u0621-\\u064A";
const ARABIC_FOLD_FROM = "أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";
const ARABIC_FOLD_TO = "اااايهوي01234567890123456789";

const FOLD = new Map<string, string>(
  [...ARABIC_FOLD_FROM].map((ch, i) => [ch, [...ARABIC_FOLD_TO][i] as string]),
);

/**
 * Canonical form for matching, identical in the index (SQL) and in queries (TypeScript):
 * lower-case; Arabic letter variants folded (alef forms to alef, alef maksura to ya, ta marbuta to ha, hamza on waw
 * and ya dropped to the plain letter); Arabic-Indic and Persian digits to 0-9; tashkeel and tatweel removed; Arabic and
 * Latin/digits separated when written together ("وRTX" -> "و rtx"); everything that is not a letter or digit becomes
 * a space; the definite article "ال" is stripped from words with at least three more letters (a light stemmer that
 * makes "الشاشة" and "شاشة" the same word); spaces collapsed.
 */
export function normalizeSearchText(input: string): string {
  let t = input.toLowerCase();
  t = [...t].map((ch) => FOLD.get(ch) ?? ch).join("");
  t = t.replace(/[\u064B-\u065F\u0670\u0640]/g, "");
  t = t.replace(new RegExp(`([${ARABIC_RANGE}])([a-z0-9])`, "g"), "$1 $2");
  t = t.replace(new RegExp(`([a-z0-9])([${ARABIC_RANGE}])`, "g"), "$1 $2");
  t = t.replace(new RegExp(`[^a-z0-9${ARABIC_RANGE}]+`, "g"), " ");
  t = t.replace(new RegExp(`(^| )ال(?=[${ARABIC_RANGE}]{3})`, "g"), "$1");
  return t.replace(/ +/g, " ").trim();
}

/** "rtx4060" -> "rtx 4060", "i5" -> "i 5". Applied to an already normalized string. */
export function splitMixed(normalized: string): string {
  return normalized.replace(/([a-z])([0-9])/g, "$1 $2").replace(/([0-9])([a-z])/g, "$1 $2");
}

/** What the index stores for a text: the normalized words plus their letter/digit-split forms. SQL twin: search_fold. */
export function foldForIndex(input: string): string {
  const n = normalizeSearchText(input);
  const s = splitMixed(n);
  return s === n ? n : `${n} ${s}`;
}

const ASCII_KEY_FROM = "ءابتثجحخدذرزسشصضطظعغفقكلمنهوي";
const ASCII_KEY_TO = "abcdefghijklmnopqrstuvwxyz0123456789".slice(0, [...ASCII_KEY_FROM].length);
const KEY = new Map<string, string>(
  [...ASCII_KEY_FROM].map((ch, i) => [ch, ASCII_KEY_TO[i] as string]),
);

/**
 * Arabic letters mapped one-to-one to ASCII, for the trigram index on the vocabulary. pg_trgm only sees a character as
 * part of a word when the DATABASE locale says it is alphanumeric; with a plain "C" locale Arabic has no trigrams at
 * all and typo tolerance silently does nothing. Trigrams over this key work in every locale. SQL twin:
 * search_ascii_key. Candidates are re-checked on the real words, so a rare Arabic/Latin key collision is harmless.
 */
export function asciiKey(word: string): string {
  return [...word].map((ch) => KEY.get(ch) ?? ch).join("");
}

/** Trims, collapses whitespace, drops control characters and caps the length. What the search box keeps in the URL. */
export function cleanQueryInput(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_MAX_CHARS)
    .trim();
}
