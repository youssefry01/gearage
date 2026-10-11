import { AA, contrastRatio } from "./contrast";
import { colorTokens, CONTRAST_PAIRS, THEMES, type ContrastPair, type ThemeName } from "./tokens";

export type PairResult = ContrastPair & {
  theme: ThemeName;
  ratio: number;
  min: number;
  pass: boolean;
};

export function evaluatePairs(pairs: readonly ContrastPair[] = CONTRAST_PAIRS): PairResult[] {
  return THEMES.flatMap((theme) =>
    pairs.map((p) => {
      const ratio = contrastRatio(colorTokens[theme][p.fg], colorTokens[theme][p.bg]);
      const min = AA[p.kind];
      return { ...p, theme, ratio, min, pass: ratio >= min };
    }),
  );
}
