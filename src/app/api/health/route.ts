import { ok } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** Liveness: no dependencies, never touches the DB. */
export function GET() {
  return ok({ status: "ok", time: new Date().toISOString() });
}
