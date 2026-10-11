/** Western digits for Arabic too (ADR 0006): numberingSystem is pinned to latn. Money is EGP; prices come from domain/money (M2a). */
export const formats = {
  number: {
    integer: { maximumFractionDigits: 0, numberingSystem: "latn" },
    egp: {
      style: "currency",
      currency: "EGP",
      currencyDisplay: "narrowSymbol",
      numberingSystem: "latn",
    },
  },
  dateTime: {
    short: { day: "numeric", month: "short", year: "numeric", numberingSystem: "latn" },
  },
} as const;
