import { accountRoutes, routes } from "./routes";

/**
 * The sections of the account area, in menu order. One list feeds the account pages' side menu and the header's account
 * menu, so a new section (orders in M6b, wishlist in M8a) is added in one place. The key is also the
 * message key under `Account.nav`.
 */
export const ACCOUNT_SECTIONS = [
  { key: "overview", href: routes.account },
  { key: "profile", href: accountRoutes.profile },
  { key: "security", href: accountRoutes.security },
  { key: "addresses", href: accountRoutes.addresses },
] as const;

export type AccountSection = (typeof ACCOUNT_SECTIONS)[number]["key"];
