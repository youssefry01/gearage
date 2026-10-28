/**
 * Route registry (locale-less paths). Header, footer and mega-menu link through this, so a path lives in one place.
 * Routes whose real page does not exist yet are served by the "coming soon" catch-all until their milestone
 * lands; a real page at the same path simply takes precedence (specific routes beat the catch-all).
 */
export const routes = {
  home: "/",
  search: "/search",
  cart: "/cart",
  wishlist: "/wishlist",
  account: "/account",
  compare: "/compare",
  deals: "/deals",
  contact: "/contact",
  about: "/about",
  faq: "/faq",
  shipping: "/shipping-delivery",
  returns: "/returns-refunds",
  warranty: "/warranty",
  terms: "/terms",
  privacy: "/privacy",
  cookies: "/cookies",
  branches: "/branches",
  status: "/status",
} as const;

export type RouteKey = keyof typeof routes;
/** Routes that have a title message (`Routes.*`): everything except home. */
export type PlaceholderRouteKey = Exclude<RouteKey, "home">;

/** Routes that have a real page, so the "coming soon" catch-all must not serve them. */
const REAL_PAGES: ReadonlySet<RouteKey> = new Set<RouteKey>(["home", "search", "deals", "compare"]);

/** Routes without a real page yet. Add a key to REAL_PAGES when its page ships. */
export const PLACEHOLDER_ROUTES = (Object.keys(routes) as RouteKey[]).filter(
  (k): k is PlaceholderRouteKey => !REAL_PAGES.has(k),
);

export function routeKeyForPath(path: string): PlaceholderRouteKey | undefined {
  const normalized = `/${path.replace(/^\/+|\/+$/g, "")}`;
  return PLACEHOLDER_ROUTES.find((k) => routes[k] === normalized);
}
