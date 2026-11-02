import { z } from "zod";
import { policies } from "@/domain/rate-limit";
import { handle, ok } from "@/lib/api-response";
import { limitRequest } from "@/server/security/rate-limit/http";
import { getSuggestions } from "@/server/services/search.service";

export const dynamic = "force-dynamic";

const querySchema = z.object({ q: z.string().max(200) });

/**
 * Instant search suggestions for the header box: a few products, categories and brands for the typed text (same
 * matching, synonyms and typo tolerance as the results page). Public and read-only. The answer depends only on `q`,
 * so it is cacheable at the CDN; with the client's debounce and abort, a two-character minimum and the per-IP rate
 * limit (fail open, ADR 0021) the load is bounded.
 */
export const GET = handle(async (request: Request) => {
  const limited = await limitRequest(request, policies.searchSuggest);
  if (limited) return limited;
  const { q } = querySchema.parse({ q: new URL(request.url).searchParams.get("q") ?? "" });
  return ok(await getSuggestions(q), {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
  });
});
