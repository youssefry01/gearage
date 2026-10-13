import { ok } from "@/lib/api-response";
import { getSystemStatus } from "@/server/services/status.service";

export const dynamic = "force-dynamic";

/**
 * Public, coarse system status for the footer dot and the /status page. ALWAYS 200 (a report, not a health probe,
 * and a non-2xx would log console errors in every visitor's browser). Cached at three layers: the service
 * (one DB probe per 30s per instance), the CDN (s-maxage) and the browser (max-age). Rate limiting by IP joins
 * in M7b with the shared limiter; until then the caches bound the load.
 */
export async function GET() {
  return ok(await getSystemStatus(), {
    headers: { "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=60" },
  });
}
