/** The machine code Better Auth puts on its errors (`APIError.body.code`), or undefined for anything else. */
export function authErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const body = (err as { body?: { code?: unknown } }).body;
  return typeof body?.code === "string" ? body.code : undefined;
}
