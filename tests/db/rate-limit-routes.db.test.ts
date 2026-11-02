import { beforeEach, describe, expect, it } from "vitest";
import { GET as cards } from "@/app/api/products/cards/route";
import { GET as status } from "@/app/api/status/route";
import { GET as suggest } from "@/app/api/search/suggest/route";
import { policies } from "@/domain/rate-limit";
import { setLimiterForTests, type Limiter } from "@/server/security/rate-limit/limiter";
import { resetData } from "./helpers";

beforeEach(async () => {
  await resetData();
  setLimiterForTests(undefined);
});

const req = (path: string) => new Request(`http://localhost${path}`);
const down: Limiter = {
  hit: async (policy) => ({
    allowed: policy.failMode === "open",
    retryAfterSec: 30,
    unavailable: true,
  }),
};

async function flood(call: () => Promise<Response>, max: number) {
  const statuses: number[] = [];
  let last: Response | undefined;
  for (let i = 0; i < max + 3; i++) {
    last = await call();
    statuses.push(last.status);
  }
  return { statuses, last: last as Response };
}

describe("public routes are rate limited per client", () => {
  it("search suggestions: normal until the limit, then 429 with the standard error body and Retry-After", async () => {
    const { statuses, last } = await flood(
      () => suggest(req("/api/search/suggest?q=ryzen")),
      policies.searchSuggest.max,
    );
    expect(statuses.slice(0, policies.searchSuggest.max).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(-3)).toEqual([429, 429, 429]);
    expect(Number(last.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    expect(last.headers.get("cache-control")).toBe("no-store");
    expect(await last.json()).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." },
    });
  });
  it("product cards: 429 over the limit", async () => {
    const { statuses } = await flood(
      () => cards(req("/api/products/cards?slugs=a,b")),
      policies.productCards.max,
    );
    expect(statuses.at(-1)).toBe(429);
    expect(statuses[0]).toBe(200);
  });
  it("status: 200 for normal visits, 429 only for a client over the limit", async () => {
    const { statuses } = await flood(() => status(req("/api/status")), policies.status.max);
    expect(statuses[0]).toBe(200);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe("failure policy per endpoint when no counter store works", () => {
  it("public reads FAIL OPEN: still served", async () => {
    setLimiterForTests(down);
    expect((await suggest(req("/api/search/suggest?q=ryzen"))).status).toBe(200);
    expect((await cards(req("/api/products/cards?slugs=a"))).status).toBe(200);
    expect((await status(req("/api/status"))).status).toBe(200);
  });
  it("a fail-closed policy answers 503 with Retry-After", async () => {
    setLimiterForTests(down);
    const { limitRequest } = await import("@/server/security/rate-limit/http");
    const response = await limitRequest(req("/x"), policies.loginIp);
    expect(response?.status).toBe(503);
    expect(Number(response?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await response?.json()).toMatchObject({ ok: false, error: { code: "UNAVAILABLE" } });
  });
});
