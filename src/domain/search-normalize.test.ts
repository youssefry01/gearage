import { describe, expect, it } from "vitest";
import {
  asciiKey,
  cleanQueryInput,
  foldForIndex,
  normalizeSearchText,
  splitMixed,
} from "./search-normalize";

describe("normalizeSearchText", () => {
  it.each([
    ["RTX-4060 Ti", "rtx 4060 ti"],
    ["  Wi-Fi 6  ", "wi fi 6"],
    ["i5-14600K DDR5-6000", "i5 14600k ddr5 6000"],
    ['27" 165Hz', "27 165hz"],
    ["", ""],
    ["!!!", ""],
  ])("lower-cases and turns punctuation into spaces: %j", (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected);
  });

  it("folds Arabic letter variants", () => {
    expect(normalizeSearchText("أإآ")).toBe("ااا");
    expect(normalizeSearchText("شاشة")).toBe("شاشه"); // ta marbuta -> ha
    expect(normalizeSearchText("مصدر طاقة")).toBe("مصدر طاقه");
    expect(normalizeSearchText("مئة")).toBe("ميه");
    expect(normalizeSearchText("مؤشر")).toBe("موشر");
    expect(normalizeSearchText("على")).toBe("علي"); // alef maksura -> ya
  });

  it("removes tashkeel and tatweel", () => {
    expect(normalizeSearchText("كَارْت")).toBe("كارت");
    expect(normalizeSearchText("شاشـــة")).toBe("شاشه");
  });

  it("maps Arabic-Indic and Persian digits to Western digits", () => {
    expect(normalizeSearchText("٤٠٦٠")).toBe("4060");
    expect(normalizeSearchText("۱۶ جيجا")).toBe("16 جيجا");
  });

  it("separates Arabic from Latin and digits written together", () => {
    expect(normalizeSearchText("وRTX")).toBe("و rtx");
    expect(normalizeSearchText("RTX4060وRyzen")).toBe("rtx4060 و ryzen");
    expect(normalizeSearchText("16جيجا")).toBe("16 جيجا");
  });

  it('strips the "ال" prefix from words with at least three more letters', () => {
    expect(normalizeSearchText("الشاشة")).toBe("شاشه");
    expect(normalizeSearchText("اللوحات الأم")).toBe("لوحات الام");
    expect(normalizeSearchText("ال جي")).toBe("ال جي"); // "LG": too short to strip
    expect(normalizeSearchText("الم")).toBe("الم");
    expect(normalizeSearchText("سلام")).toBe("سلام"); // only a prefix
  });

  it("is idempotent", () => {
    for (const s of ["كارتَ شاشـة ١٢٣", "وRTX 4060", "RTX-4060 Ti", "اللوحات الأم", "x"])
      expect(normalizeSearchText(normalizeSearchText(s))).toBe(normalizeSearchText(s));
  });

  it("treats a zero-width non-joiner like a space", () => {
    expect(normalizeSearchText("لاب\u200Cتوب")).toBe("لاب توب");
  });
});

describe("splitMixed / foldForIndex", () => {
  it("splits letter/digit boundaries", () => {
    expect(splitMixed("rtx4060ti")).toBe("rtx 4060 ti");
    expect(splitMixed("i5 14600k")).toBe("i 5 14600 k");
    expect(splitMixed("اااا")).toBe("اااا");
  });
  it("indexes the whole words and the split words", () => {
    expect(foldForIndex("RTX4060")).toBe("rtx4060 rtx 4060");
    expect(foldForIndex("Ryzen")).toBe("ryzen");
  });
});

describe("asciiKey", () => {
  it("maps each Arabic letter to its own ASCII letter and leaves ASCII alone", () => {
    expect(asciiKey("شاشه")).toHaveLength(4);
    expect(asciiKey("شاشه")).toMatch(/^[a-z0-9]+$/);
    expect(asciiKey("ryzen5")).toBe("ryzen5");
    expect(asciiKey("كارت")).not.toBe(asciiKey("كرت"));
  });
  it("is injective over the Arabic alphabet", () => {
    const letters = [..."ءابتثجحخدذرزسشصضطظعغفقكلمنهوي"];
    expect(new Set(letters.map(asciiKey)).size).toBe(letters.length);
  });
});

describe("cleanQueryInput", () => {
  it("trims, collapses whitespace, drops control characters and caps at 100", () => {
    expect(cleanQueryInput("  rtx \n\t 4060 ")).toBe("rtx 4060");
    expect(cleanQueryInput("a\u0000b")).toBe("a b");
    expect(cleanQueryInput("x".repeat(300))).toHaveLength(100);
  });
});
