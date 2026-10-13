/**
 * The fixed viewport matrix every milestone is checked against, in LTR (en) and RTL (ar).
 * Mobile-first: 320px phones up to ultra-wide. Add a row here and every responsive/a11y spec covers it.
 * `touch` rows run as real touch contexts (isMobile + hasTouch => `(pointer: coarse)`), which is what the 44px
 * target rule is defined against.
 */
const row = (name: string, width: number, height: number) => ({
  name,
  width,
  height,
  touch: width < 1024 || height < 500,
});

export const VIEWPORTS = [
  row("phone-small-320", 320, 568),
  row("phone-360", 360, 740),
  row("phone-390", 390, 844),
  row("phone-landscape", 844, 390),
  row("foldable-600", 600, 960),
  row("tablet-768", 768, 1024),
  row("tablet-landscape-1024", 1024, 768),
  row("laptop-1280", 1280, 800),
  row("desktop-1920", 1920, 1080),
  row("ultrawide-3440", 3440, 1440),
] as const;

export const LOCALES = ["en", "ar"] as const;
export const THEMES = ["dark", "light"] as const;
/** Pages covered by the responsive/a11y specs ("" = home). The style guide is enabled by ENABLE_STYLEGUIDE=1. */
export const PAGES = ["", "/styleguide", "/cart", "/c/components/graphics-cards"] as const;
