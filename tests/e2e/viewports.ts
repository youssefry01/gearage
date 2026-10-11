/**
 * The fixed viewport matrix every milestone is checked against, in LTR (en) and RTL (ar).
 * Mobile-first: 320px phones up to ultra-wide. Add a row here and every responsive/a11y spec covers it.
 */
export const VIEWPORTS = [
  { name: "phone-small-320", width: 320, height: 568 },
  { name: "phone-360", width: 360, height: 740 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-landscape", width: 844, height: 390 },
  { name: "foldable-600", width: 600, height: 960 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "tablet-landscape-1024", width: 1024, height: 768 },
  { name: "laptop-1280", width: 1280, height: 800 },
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "ultrawide-3440", width: 3440, height: 1440 },
] as const;

export const LOCALES = ["en", "ar"] as const;
export const THEMES = ["dark", "light"] as const;
/** Pages covered by the responsive/a11y specs ("" = home). The style guide is enabled by ENABLE_STYLEGUIDE=1. */
export const PAGES = ["", "/styleguide"] as const;
