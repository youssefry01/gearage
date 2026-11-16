/**
 * What the header may learn about the visitor (M5b-2b, ADR 0028): whether a session exists and the first name for the
 * greeting. Nothing else (no email, no id) leaves the server through this shape.
 */
export type AccountState = { signedIn: false } | { signedIn: true; name: string; initial: string };

/** The first letter the person would recognise (a whole character, so an Arabic or emoji initial is not cut in half). */
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : "?";
}

export function accountStateFor(firstName: string | null): AccountState {
  if (firstName === null) return { signedIn: false };
  const name = firstName.trim();
  return { signedIn: true, name, initial: initialOf(name) };
}

/** Narrows the parsed JSON of /api/account/state; anything unexpected is `null` (the header then stays neutral). */
export function parseAccountState(value: unknown): AccountState | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as { ok?: unknown; data?: unknown };
  if (body.ok !== true || typeof body.data !== "object" || body.data === null) return null;
  const data = body.data as { signedIn?: unknown; name?: unknown; initial?: unknown };
  if (data.signedIn === false) return { signedIn: false };
  if (data.signedIn === true && typeof data.name === "string" && typeof data.initial === "string") {
    return { signedIn: true, name: data.name, initial: data.initial };
  }
  return null;
}

/** Pages where a session starts or ends, or where the person's details change: leaving one of them refreshes the header. */
const AUTH_AREA = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/account",
  "/email-change",
] as const;

export function isAuthArea(pathname: string): boolean {
  return AUTH_AREA.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
