/**
 * Single source of truth for COLOR tokens. Everything else derives from this file:
 *   - src/styles/tokens.css is GENERATED from it (`npm run tokens:build`, drift fails CI via `tokens:check`)
 *   - the contrast gate (`npm run contrast`) evaluates `CONTRAST_PAIRS` for every theme
 *   - brand asset generation reads the dark surface from here
 * Never write a hex color in a component; use the semantic Tailwind classes (bg-background, text-link, ...).
 * Non-color tokens (type, radius, motion, layout) live in src/styles/theme.css.
 */
import type { AaKind } from "./contrast";

/** The two brand colors, defined exactly once. */
export const brandColors = { orange: "#F56514", ink: "#0D1114" } as const;

export const THEMES = ["dark", "light"] as const;
export type ThemeName = (typeof THEMES)[number];

/** Dark is the brand-native look and the default. */
const dark = {
  background: brandColors.ink,
  foreground: "#F2F4F5",
  card: "#151A1F",
  "card-foreground": "#F2F4F5",
  popover: "#1B2127",
  "popover-foreground": "#F2F4F5",
  primary: brandColors.orange,
  "primary-hover": "#FF7A33",
  "primary-foreground": brandColors.ink,
  secondary: "#1F262D",
  "secondary-foreground": "#F2F4F5",
  muted: "#1A2026",
  "muted-foreground": "#A3ADB5",
  accent: "#232B33",
  "accent-foreground": "#F2F4F5",
  /** Decorative dividers only (exempt from non-text contrast). Use `input` for control boundaries. */
  border: "#2A323A",
  input: "#66717B",
  ring: brandColors.orange,
  /** Orange as TEXT/link color. Same as the brand fill on dark surfaces. */
  link: brandColors.orange,
  "link-hover": "#FF8040",
  destructive: "#E5484D",
  "destructive-foreground": brandColors.ink,
  success: "#4ADE80",
  warning: "#FBBF24",
  danger: "#FF7B7B",
} as const;

export type ColorToken = keyof typeof dark;

const light: Record<ColorToken, string> = {
  background: "#FFFFFF",
  foreground: brandColors.ink,
  card: "#F4F6F7",
  "card-foreground": brandColors.ink,
  popover: "#FFFFFF",
  "popover-foreground": brandColors.ink,
  /** Bright orange stays for fills; its label is dark ink (white on orange is only 3.1:1). */
  primary: brandColors.orange,
  "primary-hover": "#E25A0D",
  "primary-foreground": brandColors.ink,
  secondary: "#E8ECEF",
  "secondary-foreground": brandColors.ink,
  muted: "#EDF0F2",
  "muted-foreground": "#55616B",
  accent: "#E8ECEF",
  "accent-foreground": brandColors.ink,
  border: "#D5DADF",
  input: "#68737D",
  /** Orange on white is 3.1:1, so text and links use this darker token (5.2:1 on white). */
  ring: "#C2410C",
  link: "#C2410C",
  "link-hover": "#9A3412",
  destructive: "#B42318",
  "destructive-foreground": "#FFFFFF",
  success: "#16794A",
  warning: "#8A5A00",
  danger: "#B42318",
};

export const colorTokens: Record<ThemeName, Record<ColorToken, string>> = { dark, light };
export const COLOR_TOKEN_NAMES = Object.keys(dark) as ColorToken[];

/** Browser chrome color per theme (metadata `themeColor`). */
export const themeColors: Record<ThemeName, string> = {
  dark: dark.background,
  light: light.background,
};

export type ContrastPair = { fg: ColorToken; bg: ColorToken; kind: AaKind; use: string };

/**
 * Every foreground/background combination the design system promises. The CI gate fails if ANY pair in ANY
 * theme drops below WCAG AA (text 4.5, large text and UI components 3). Add a pair when you add a usage.
 */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { fg: "foreground", bg: "background", kind: "text", use: "body text" },
  { fg: "foreground", bg: "card", kind: "text", use: "text on cards" },
  { fg: "card-foreground", bg: "card", kind: "text", use: "card text" },
  { fg: "popover-foreground", bg: "popover", kind: "text", use: "menus and popovers" },
  { fg: "muted-foreground", bg: "background", kind: "text", use: "secondary text" },
  { fg: "muted-foreground", bg: "card", kind: "text", use: "secondary text on cards" },
  { fg: "muted-foreground", bg: "muted", kind: "text", use: "text on muted fills" },
  { fg: "primary-foreground", bg: "primary", kind: "text", use: "primary button label" },
  {
    fg: "primary-foreground",
    bg: "primary-hover",
    kind: "text",
    use: "primary button label (hover)",
  },
  { fg: "secondary-foreground", bg: "secondary", kind: "text", use: "secondary button label" },
  { fg: "accent-foreground", bg: "accent", kind: "text", use: "hovered menu item" },
  { fg: "link", bg: "background", kind: "text", use: "links" },
  { fg: "link", bg: "card", kind: "text", use: "links on cards" },
  { fg: "link-hover", bg: "background", kind: "text", use: "links (hover)" },
  {
    fg: "destructive-foreground",
    bg: "destructive",
    kind: "text",
    use: "destructive button label",
  },
  { fg: "danger", bg: "background", kind: "text", use: "error text" },
  { fg: "danger", bg: "card", kind: "text", use: "error text on cards" },
  { fg: "success", bg: "background", kind: "text", use: "success text" },
  { fg: "success", bg: "card", kind: "text", use: "success text on cards" },
  { fg: "warning", bg: "background", kind: "text", use: "warning text" },
  { fg: "warning", bg: "card", kind: "text", use: "warning text on cards" },
  // Non-text (UI components and graphics): 3:1
  { fg: "primary", bg: "background", kind: "ui", use: "primary button vs page" },
  { fg: "ring", bg: "background", kind: "ui", use: "focus ring vs page" },
  { fg: "ring", bg: "card", kind: "ui", use: "focus ring vs card" },
  { fg: "input", bg: "background", kind: "ui", use: "form control border vs page" },
  { fg: "input", bg: "card", kind: "ui", use: "form control border vs card" },
  { fg: "destructive", bg: "background", kind: "ui", use: "destructive button vs page" },
  { fg: "success", bg: "background", kind: "ui", use: "status indicator: operational" },
  { fg: "warning", bg: "background", kind: "ui", use: "status indicator: degraded" },
  { fg: "danger", bg: "background", kind: "ui", use: "status indicator: down" },
];
