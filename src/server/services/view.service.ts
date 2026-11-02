import { policies } from "@/domain/rate-limit";
import { isLikelyBot, utcDay } from "@/domain/visitor";
import { hmacHex } from "@/server/security/keys";
import { getLimiter, type Limiter } from "@/server/security/rate-limit/limiter";
import * as repo from "@/server/repositories/view.repository";

export type ViewInput = { slug: string; ip: string; userAgent: string | null; now?: Date };
export type ViewOutcome = "counted" | "ignored";

/**
 * Anonymous view counting (ADR 0023). No cookie and nothing stored on the device. The visitor is a keyed hash of
 * IP + user agent under a key that changes every UTC day, so it cannot be linked across days (or reversed) and is
 * never stored: it only keys the "one view per visitor, product and 30 minutes" dedupe counter. Bots are skipped.
 * Everything fails open and quiet: when the limiter cannot answer, the view is simply not counted.
 */
export async function recordView(
  input: ViewInput,
  deps: { limiter?: Limiter; increment?: typeof repo.incrementViews } = {},
): Promise<ViewOutcome> {
  if (isLikelyBot(input.userAgent)) return "ignored";
  const now = input.now ?? new Date();
  const day = utcDay(now);
  const visitor = hmacHex("view-visitor", `${input.ip}|${input.userAgent ?? ""}`, day);
  const dedupe = await (deps.limiter ?? getLimiter()).hit(
    policies.viewDedupe,
    `${visitor}|${input.slug}`,
  );
  if (dedupe.unavailable || !dedupe.allowed) return "ignored";
  return (await (deps.increment ?? repo.incrementViews)(input.slug, day)) ? "counted" : "ignored";
}
