import { routes } from "@/config/routes";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/locales";
import { getSession, type AppSession } from "@/server/auth/session";

/**
 * The signed-in session for an account page, or a redirect to sign-in that returns here afterwards. Every account page
 * calls this itself: a layout is not a security boundary (Next renders pages and layouts independently), the page that
 * reads the data is.
 */
export async function requireSession(locale: Locale, path: string): Promise<AppSession> {
  const session = await getSession();
  if (!session)
    return redirect({ href: `${routes.login}?next=${encodeURIComponent(path)}`, locale });
  return session;
}
