/**
 * Cookie/storage consent (Egypt PDPL 151/2020: consent must be informed, specific and recorded).
 * Essential storage (language, theme, cart) needs no consent. Everything else is OFF until the visitor opts in.
 * The record is a first-party cookie so a future server-side gate can read it; it stores a version and timestamp.
 */
export const CONSENT_COOKIE = "consent";
/** Window events: the footer button asks the banner to reopen; the banner announces a saved choice. */
export const COOKIE_SETTINGS_EVENT = "cookie-settings:open";
export const CONSENT_CHANGE_EVENT = "consentchange";
export const CONSENT_VERSION = 1;
/** About 6 months, after which we ask again. */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export type Consent = { v: typeof CONSENT_VERSION; analytics: boolean; ts: number };

export function parseConsent(raw: string | null | undefined): Consent | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof value !== "object" || value === null) return null;
    const v = value as Record<string, unknown>;
    if (v["v"] !== CONSENT_VERSION || typeof v["analytics"] !== "boolean") return null;
    if (typeof v["ts"] !== "number" || !Number.isFinite(v["ts"])) return null;
    return { v: CONSENT_VERSION, analytics: v["analytics"], ts: v["ts"] };
  } catch {
    return null;
  }
}

export const makeConsent = (analytics: boolean, now: number = Date.now()): Consent => ({
  v: CONSENT_VERSION,
  analytics,
  ts: now,
});

export const serializeConsent = (c: Consent): string => encodeURIComponent(JSON.stringify(c));

/** Value for `document.cookie = ...`. `secure` should be true on https. */
export function consentCookieString(c: Consent, secure: boolean): string {
  return `${CONSENT_COOKIE}=${serializeConsent(c)}; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Reads the consent record out of a `document.cookie` style string. */
export function readConsent(cookieHeader: string): Consent | null {
  const part = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(part?.slice(CONSENT_COOKIE.length + 1));
}
