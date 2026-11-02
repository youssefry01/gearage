import { z } from "zod";
import { policies } from "@/domain/rate-limit";
import { handle } from "@/lib/api-response";
import { clientSubject, limitRequest } from "@/server/security/rate-limit/http";
import { recordView } from "@/server/services/view.service";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const bodySchema = z.object({ slug: z.string().max(80).regex(SLUG) });
const MAX_BODY_BYTES = 512;

/**
 * Counts a product page view (ADR 0023). Always 204 for a valid request, whether or not the view was counted, so the
 * answer reveals nothing (not the dedupe, not the bot filter, not whether the slug exists). 422 for a malformed body,
 * 429 over the per-IP limit. Same-origin only: the browser sends the Origin header on this POST.
 */
export const POST = handle(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    return new Response(null, { status: 204 });
  }
  const limited = await limitRequest(request, policies.viewIp);
  if (limited) return limited;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  const { slug } = bodySchema.parse(json);
  await recordView({
    slug,
    ip: clientSubject(request.headers),
    userAgent: request.headers.get("user-agent"),
  });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
});
