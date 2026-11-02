import { NextResponse } from "next/server";
import type { RateLimitPolicy } from "@/domain/rate-limit";
import { getEnv } from "@/lib/env";
import type { ApiFailure } from "@/lib/api-response";
import { getClientIp } from "@/server/security/client-ip";
import { getLimiter } from "./limiter";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function failure(status: number, code: string, message: string, retryAfterSec: number): Response {
  const body: ApiFailure = { ok: false, error: { code, message } };
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE, "Retry-After": String(retryAfterSec) },
  });
}

/** The caller's identifier for per-IP limits: the trusted client IP, or one shared "unknown" bucket. */
export function clientSubject(headers: Headers): string {
  const env = getEnv();
  return (
    getClientIp(headers, {
      onVercel: process.env.VERCEL === "1",
      trustProxyHeaders: env.TRUST_PROXY_HEADERS === "1",
    }) ?? "unknown"
  );
}

/**
 * Applies a policy to a request, per client IP. Returns the response to send (429 over the limit, 503 when both
 * stores are down and the policy fails closed) or null when the request may proceed.
 */
export async function limitRequest(
  request: Request,
  policy: RateLimitPolicy,
): Promise<Response | null> {
  const result = await getLimiter().hit(policy, clientSubject(request.headers));
  if (result.allowed) return null;
  if (result.unavailable) {
    return failure(
      503,
      "UNAVAILABLE",
      "Temporarily unavailable. Try again shortly.",
      result.retryAfterSec,
    );
  }
  return failure(429, "RATE_LIMITED", "Too many requests. Try again later.", result.retryAfterSec);
}
