import { policies } from "@/domain/rate-limit";
import { ok } from "@/lib/api-response";
import { limitRequest } from "@/server/security/rate-limit/http";
import { getSystemStatus } from "@/server/services/status.service";

export const dynamic = "force-dynamic";

/**
 * Public, coarse system status for the footer dot and the /status page. 200 for every normal visit (a report, not a health
 * probe; a non-2xx would log console errors in the visitor's browser). Only a client over the per-IP limit gets 429. Cached at three layers: the service
 * (one DB probe per 30s per instance), the CDN (s-maxage) and the browser (max-age). Rate limited per IP (fail open,
 * ADR 0021).
 */
export async function GET(request: Request) {
  const limited = await limitRequest(request, policies.status);
  if (limited) return limited;
  return ok(await getSystemStatus(), {
    headers: { "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=60" },
  });
}
