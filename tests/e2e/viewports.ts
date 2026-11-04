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
/** The verify page needs the signed pending-verification cookie (see page-setup.ts). */
export const VERIFY_PAGE = "/verify-email";
/** Pages that need a signed-in session (global setup saves one; page-setup.ts loads it). */
export const SIGNED_IN_PAGES = ["/account", "/account/profile", "/account/security"] as const;
/** Pages covered by the responsive/a11y specs ("" = home). The style guide is enabled by ENABLE_STYLEGUIDE=1. */
export const PAGES = [
  "",
  "/styleguide",
  "/cart",
  "/c/components/graphics-cards",
  "/c/components/graphics-cards?in_stock=1&sort=price-asc",
  "/c/pc-bundles",
  "/c/components/cpus?brand=nvidia",
  // Product pages: a part (low stock, showcase with video) and a bundle (parts table, compatibility badge).
  "/p/nvidia-geforce-rtx-5080-founders-edition-16gb",
  "/p/budget-gaming-pc-ryzen-5-5600-rtx-4060",
  // Search results (M4a): matches, the all-products view (also deals / best sellers), a corrected search, no results.
  "/search?q=rtx%204060",
  "/search?in_stock=1&sale=1&sort=discount",
  "/search?q=ryzn%205%205600",
  "/search?q=xyzzy",
  // Compare (M4b): three graphics cards of different brands, two bundles, and the empty state.
  "/compare?p=asus-dual-geforce-rtx-4060-oc-edition-8gb,asus-prime-geforce-rtx-5070-oc-edition-12gb,gigabyte-geforce-rtx-5060-ti-windforce-oc-16gb",
  "/compare?p=budget-gaming-pc-ryzen-5-5600-rtx-4060,high-end-gaming-pc-ryzen-7-7800x3d-rtx-5080",
  "/compare",
  // Authentication (M5a-2): every public form page, the verify page runs with a signed pending-verification cookie (the specs add it).
  "/login",
  "/register",
  VERIFY_PAGE,
  "/forgot-password",
  "/reset-password#token=abcdefghijklmnopqrstuvwx",
  // Account (M5a-2, M5b-1): need the signed-in session.
  "/account",
  "/account/profile",
  "/account/security",
] as const;
