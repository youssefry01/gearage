import { z } from "zod";
import { RECENT_MAX } from "@/domain/recently-viewed";
import { policies } from "@/domain/rate-limit";
import { handle, ok } from "@/lib/api-response";
import { limitRequest } from "@/server/security/rate-limit/http";
import { getCardsBySlugs } from "@/server/services/cards.service";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const querySchema = z.object({
  slugs: z
    .string()
    .max(RECENT_MAX * 81)
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(z.string().max(80).regex(SLUG)).min(1).max(RECENT_MAX)),
});

/**
 * Cards for product slugs, for the "recently viewed" shelf (the list itself lives on the shopper's device). Public,
 * read-only, bounded (at most RECENT_MAX slugs, one indexed statement), and cacheable per slug list. Per-IP rate limited
 * (fail open, ADR 0021).
 */
export const GET = handle(async (request: Request) => {
  const limited = await limitRequest(request, policies.productCards);
  if (limited) return limited;
  const { slugs } = querySchema.parse({
    slugs: new URL(request.url).searchParams.get("slugs") ?? "",
  });
  return ok(
    { items: await getCardsBySlugs(slugs) },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } },
  );
});
