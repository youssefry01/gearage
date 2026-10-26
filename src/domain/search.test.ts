import { describe, expect, it } from "vitest";
import {
  applyCorrections,
  correctableTokens,
  editDistance,
  isCorrectable,
  isLoggableSearchTerm,
  isSearchable,
  maxEdits,
  parseSearchQuery,
  phrasePatterns,
  pickCorrection,
  termsMatchText,
  toPartialTsQueryTexts,
  toTsQueryText,
  SYNONYM_WORDS,
} from "./search";
import { SYNONYM_GROUPS, SYNONYM_MAX_TOKENS, buildSynonymIndex } from "./search-synonyms";
import { normalizeSearchText } from "./search-normalize";

const ts = (q: string, mode: "all" | "any" = "all") => toTsQueryText(parseSearchQuery(q), mode);

describe("parseSearchQuery", () => {
  it("makes one term per word", () => {
    const p = parseSearchQuery("ryzen 5 5600");
    expect(p.terms.map((t) => t.source)).toEqual(["ryzen", "5", "5600"]);
  });

  it("gives a model number written together both forms", () => {
    const [t] = parseSearchQuery("rtx4060").terms;
    expect(t?.alternatives).toEqual([["rtx4060"], ["rtx", "4060"]]);
  });

  it("does not split tokens whose letter part is a single letter", () => {
    expect(parseSearchQuery("i5").terms[0]?.alternatives).toEqual([["i5"]]);
    expect(parseSearchQuery("14600k").terms[0]?.alternatives).toEqual([["14600k"]]);
    expect(parseSearchQuery("b650m").terms[0]?.alternatives).toEqual([["b650m"]]);
  });

  it("matches synonym phrases, longest first", () => {
    const p = parseSearchQuery("cooler master hyper");
    expect(p.terms.map((t) => t.source)).toEqual(["cooler master", "hyper"]);
  });

  it("expands Arabic and English names of the same thing to one group", () => {
    const a = parseSearchQuery("كارت الشاشة").terms[0];
    const b = parseSearchQuery("graphics card").terms[0];
    const c = parseSearchQuery("gpu").terms[0];
    expect(a?.alternatives).toEqual(b?.alternatives);
    expect(b?.alternatives).toEqual(c?.alternatives);
    expect(a?.alternatives).toContainEqual(["كارت", "شاشه"]);
    expect(a?.alternatives).toContainEqual(["gpu"]);
  });

  it("resolves Arabic spellings of brands", () => {
    expect(parseSearchQuery("انفيديا").terms[0]?.alternatives).toContainEqual(["nvidia"]);
    expect(parseSearchQuery("إنتل").terms[0]?.alternatives).toContainEqual(["intel"]);
    expect(parseSearchQuery("رايزن").terms[0]?.alternatives).toContainEqual(["ryzen"]);
  });

  it("drops stop words unless nothing else is left", () => {
    expect(parseSearchQuery("best gaming mouse for 27 inch").terms.map((t) => t.source)).toEqual([
      "gaming",
      "mouse",
      "27",
    ]);
    expect(parseSearchQuery("best").terms.map((t) => t.source)).toEqual(["best"]);
  });

  it("limits the number of terms and the length", () => {
    const p = parseSearchQuery(Array.from({ length: 30 }, (_, i) => `word${i}`).join(" "));
    expect(p.terms.length).toBeLessThanOrEqual(8);
    expect(parseSearchQuery("x".repeat(500)).input.length).toBeLessThanOrEqual(100);
  });

  it("has no terms for empty or punctuation-only input", () => {
    for (const q of ["", "   ", "!!!", "---"]) expect(parseSearchQuery(q).terms).toEqual([]);
  });

  it("is searchable from two characters", () => {
    expect(isSearchable(parseSearchQuery("a"))).toBe(false);
    expect(isSearchable(parseSearchQuery("ab"))).toBe(true);
    expect(isSearchable(parseSearchQuery(""))).toBe(false);
  });
});

describe("toTsQueryText", () => {
  it("prefix-matches words of three or more characters and matches shorter ones exactly", () => {
    expect(ts("kraken 5")).toBe("((kraken:*)) & ((5))");
  });

  it("restricts synonym alternatives to title, brand, category and tags (weights A and B)", () => {
    const text = ts("gpu") ?? "";
    expect(text).toContain("(gpu:*)"); // what the shopper typed matches anywhere
    expect(text).toContain("graphics:*AB"); // an expansion matches titles/categories only
    expect(text).toMatch(/\(كارت:\*AB <-> شاشه:\*AB\)/);
  });

  it("builds an any-term query when asked", () => {
    expect(ts("logitech keyboard", "any")).toMatch(/ \| /);
    expect(ts("logitech keyboard", "all")).toMatch(/ & /);
  });

  it("keeps the parts of a split model number adjacent", () => {
    expect(ts("2tb")).toBe("((2tb:*) | (2 <-> tb))");
  });

  it("builds partial queries from words only, and ranks with all terms", () => {
    const partial = toPartialTsQueryTexts(parseSearchQuery("gtx 1080"));
    expect(partial?.match).toBe("((gtx:*))");
    expect(partial?.rank).toContain("1080");
    expect(toPartialTsQueryTexts(parseSearchQuery("4070 8"))).toBeNull();
    expect(toPartialTsQueryTexts(parseSearchQuery("logitech keyboard xyz"))?.match).toMatch(/ \| /);
  });

  it("returns null when there is nothing to search", () => {
    expect(ts("")).toBeNull();
    expect(ts("!!!")).toBeNull();
  });

  it("can never emit tsquery syntax from user input", () => {
    const hostile = [
      "a' | b",
      "foo & !bar",
      "(x) <-> y",
      "rtx:* | 1",
      "'; DROP TABLE product; --",
      "a\\b",
      "\u0000\u0001",
      "<script>alert(1)</script>",
      "foo:A bar:*B",
    ];
    for (const q of hostile) {
      const out = ts(q);
      if (out === null) continue;
      // Only the operators this module writes itself: ( ) & | and :* / :*AB / :AB suffixes on plain words.
      expect(out.replace(/[a-z0-9\u0621-\u064A]+(:\*?(AB)?)?/g, "w")).toMatch(/^[w()&| <>-]*$/);
    }
  });
});

describe("phrasePatterns", () => {
  it("covers the normalized and the split form, without stop words", () => {
    expect(phrasePatterns(parseSearchQuery("best RTX4060"))).toEqual(["%rtx4060%", "%rtx 4060%"]);
    expect(phrasePatterns(parseSearchQuery("ryzen"))).toEqual(["%ryzen%"]);
  });
  it("is empty when there is nothing to boost on", () => {
    expect(phrasePatterns(parseSearchQuery(""))).toEqual([]);
  });
});

describe("termsMatchText", () => {
  it("matches words as prefixes and across languages through synonyms", () => {
    expect(termsMatchText(parseSearchQuery("graph"), "Graphics Cards")).toBe(true);
    expect(termsMatchText(parseSearchQuery("gpu"), "Graphics Cards")).toBe(true);
    expect(termsMatchText(parseSearchQuery("انفيديا"), "NVIDIA")).toBe(true);
    expect(termsMatchText(parseSearchQuery("storage ssd"), "Graphics Cards")).toBe(false);
  });
});

describe("typo correction rules", () => {
  it("computes edit distance with adjacent swaps as one edit", () => {
    expect(editDistance("corsair", "corsiar")).toBe(1);
    expect(editDistance("ryzen", "ryzn")).toBe(1);
    expect(editDistance("nvidia", "nvidea")).toBe(1);
    expect(editDistance("كارت", "كرت")).toBe(1);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("same", "same")).toBe(0);
  });

  it("allows more edits for longer words", () => {
    expect(maxEdits(4)).toBe(1);
    expect(maxEdits(7)).toBe(2);
    expect(maxEdits(12)).toBe(3);
  });

  it("corrects only words: never model numbers, never very short words", () => {
    expect(isCorrectable("ryzn")).toBe(true);
    expect(isCorrectable("كارت")).toBe(true);
    expect(isCorrectable("4060")).toBe(false);
    expect(isCorrectable("rtx4060")).toBe(false);
    expect(isCorrectable("rtx")).toBe(false);
    expect(correctableTokens(parseSearchQuery("ryzn 5 5600 gpu"))).toEqual(["ryzn"]);
  });

  it("picks the closest word, then the more common one, deterministically", () => {
    const vocab = [
      { word: "ryzen", freq: 12 },
      { word: "rizen", freq: 1 },
      { word: "rayon", freq: 40 },
    ];
    expect(pickCorrection("ryzn", vocab)).toBe("ryzen");
    expect(pickCorrection("ryzen", vocab)).toBe("rizen"); // identical word is not a correction
    expect(pickCorrection("zzzz", vocab)).toBeUndefined();
    const tie = [
      { word: "aaab", freq: 5 },
      { word: "aaac", freq: 5 },
    ];
    expect(pickCorrection("aaad", tie)).toBe("aaab");
    expect(pickCorrection("aaad", [...tie].reverse())).toBe("aaab");
  });

  it("can correct a misspelled Arabic brand against the synonym words", () => {
    expect(pickCorrection("انفديا", SYNONYM_WORDS)).toBe("انفيديا");
    expect(pickCorrection("لينوفوو", SYNONYM_WORDS)).toBe("لينوفو");
    expect(pickCorrection("nvidea", SYNONYM_WORDS)).toBe("nvidia");
  });

  it("substitutes corrections into the typed words", () => {
    const p = parseSearchQuery("ryzn 5 5600");
    expect(applyCorrections(p, new Map([["ryzn", "ryzen"]]))).toBe("ryzen 5 5600");
  });
});

describe("isLoggableSearchTerm", () => {
  const log = (q: string) => isLoggableSearchTerm(q, normalizeSearchText(q));
  it("stores ordinary product searches", () => {
    expect(log("rtx 4060")).toBe(true);
    expect(log("كارت شاشة")).toBe(true);
    expect(log("ddr5 6000 32gb")).toBe(true);
  });
  it("never stores emails, phone numbers or long numbers", () => {
    expect(log("someone@example.com")).toBe(false);
    expect(log("01012345678")).toBe(false);
    expect(log("0101 234 5678")).toBe(false);
    expect(log("٠١٠١٢٣٤٥٦٧٨")).toBe(false);
    expect(log("order 12345678")).toBe(false);
  });
  it("needs two characters", () => {
    expect(log("a")).toBe(false);
  });
});

describe("synonym dictionary", () => {
  it("builds without conflicts", () => {
    expect(() => buildSynonymIndex(SYNONYM_GROUPS)).not.toThrow();
  });

  it("rejects a phrase claimed by two groups", () => {
    expect(() =>
      buildSynonymIndex([
        { id: "a", terms: ["x", "y"] },
        { id: "b", terms: ["Y", "z"] },
      ]),
    ).toThrow(/both/);
  });

  it("has unique ids and at least two distinct members per group", () => {
    const ids = SYNONYM_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of SYNONYM_GROUPS)
      expect(new Set(g.terms.map(normalizeSearchText)).size, g.id).toBeGreaterThanOrEqual(2);
  });

  it("keeps every phrase short and in canonical form", () => {
    for (const g of SYNONYM_GROUPS)
      for (const term of g.terms) {
        const n = normalizeSearchText(term);
        expect(n, `${g.id}: ${term}`).not.toBe("");
        expect(n.split(" ").length, `${g.id}: ${term}`).toBeLessThanOrEqual(SYNONYM_MAX_TOKENS);
        expect(normalizeSearchText(n)).toBe(n);
      }
  });
});
