import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed middleware.ts to proxy.ts.
export default createMiddleware(routing);

export const config = {
  // Everything except /api, Next internals and files with an extension (favicon.ico, images, sitemap.xml, ...).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
