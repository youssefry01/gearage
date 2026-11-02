import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/products/view/route";
import { policies } from "@/domain/rate-limit";
import { incrementViews } from "@/server/repositories/view.repository";
import {
  setLimiterForTests,
  createLimiter,
  defaultKeyFor,
} from "@/server/security/rate-limit/limiter";
import { postgresStore } from "@/server/security/rate-limit/stores";
import { recordView } from "@/server/services/view.service";
import { db, makeBrand, makeProduct, resetData } from "./helpers";

beforeEach(async () => {
  await resetData();
  setLimiterForTests(undefined);
});

const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const t0 = new Date("2026-10-30T12:00:00.000Z");
const viewsOf = async (id: string) =>
  (await db().product.findUniqueOrThrow({ where: { id } })).viewCount;

describe("view repository", () => {
  it("adds one to the total and to the day's row, in one statement", async () => {
    const p = await makeProduct({ slug: "rtx-4060" });
    expect(await incrementViews("rtx-4060", "2026-10-30")).toBe(true);
    expect(await incrementViews("rtx-4060", "2026-10-30")).toBe(true);
    expect(await incrementViews("rtx-4060", "2026-10-31")).toBe(true);
    expect(await viewsOf(p.id)).toBe(3);
    const days = await db().productViewDaily.findMany({
      where: { productId: p.id },
      orderBy: { day: "asc" },
    });
    expect(days.map((d) => [d.day.toISOString().slice(0, 10), d.count])).toEqual([
      ["2026-10-30", 2],
      ["2026-10-31", 1],
    ]);
  });
  it("is correct under concurrency", async () => {
    const p = await makeProduct({ slug: "busy" });
    await Promise.all(Array.from({ length: 25 }, () => incrementViews("busy", "2026-10-30")));
    expect(await viewsOf(p.id)).toBe(25);
    expect(
      (await db().productViewDaily.findFirstOrThrow({ where: { productId: p.id } })).count,
    ).toBe(25);
  });
  it("counts nothing for a product a shopper cannot see (draft, deleted, unknown slug)", async () => {
    const draft = await makeProduct({ slug: "draft", status: "DRAFT" });
    const gone = await makeProduct({ slug: "gone", deletedAt: new Date() });
    expect(await incrementViews("draft", "2026-10-30")).toBe(false);
    expect(await incrementViews("gone", "2026-10-30")).toBe(false);
    expect(await incrementViews("nope", "2026-10-30")).toBe(false);
    expect(await viewsOf(draft.id)).toBe(0);
    expect(await viewsOf(gone.id)).toBe(0);
    expect(await db().productViewDaily.count()).toBe(0);
  });
  it("counts nothing for a product of a deactivated brand", async () => {
    const brand = await makeBrand();
    await db().brand.update({ where: { id: brand.id }, data: { isActive: false } });
    const p = await makeProduct({ slug: "branded" });
    await db().product.update({ where: { id: p.id }, data: { brandId: brand.id } });
    expect(await incrementViews("branded", "2026-10-30")).toBe(false);
  });
  it("deleting a product removes its daily rows", async () => {
    const p = await makeProduct({ slug: "cascade" });
    await incrementViews("cascade", "2026-10-30");
    await db().product.delete({ where: { id: p.id } });
    expect(await db().productViewDaily.count()).toBe(0);
  });
});

describe("recordView", () => {
  const limiter = () =>
    createLimiter({ primary: null, fallback: postgresStore, keyFor: defaultKeyFor });

  it("counts one view per visitor, product and half hour", async () => {
    const p = await makeProduct({ slug: "dedupe" });
    const input = { slug: "dedupe", ip: "203.0.113.9", userAgent: BROWSER, now: t0 };
    expect(await recordView(input, { limiter: limiter() })).toBe("counted");
    expect(await recordView(input, { limiter: limiter() })).toBe("ignored");
    expect(await viewsOf(p.id)).toBe(1);
  });
  it("counts different visitors separately", async () => {
    const p = await makeProduct({ slug: "two" });
    await recordView(
      { slug: "two", ip: "203.0.113.9", userAgent: BROWSER, now: t0 },
      { limiter: limiter() },
    );
    await recordView(
      { slug: "two", ip: "203.0.113.10", userAgent: BROWSER, now: t0 },
      { limiter: limiter() },
    );
    expect(await viewsOf(p.id)).toBe(2);
  });
  it("never counts a bot", async () => {
    const p = await makeProduct({ slug: "bot" });
    for (const ua of ["Googlebot/2.1", "curl/8.5.0", null]) {
      expect(
        await recordView(
          { slug: "bot", ip: "1.1.1.1", userAgent: ua, now: t0 },
          { limiter: limiter() },
        ),
      ).toBe("ignored");
    }
    expect(await viewsOf(p.id)).toBe(0);
  });
  it("FAILS OPEN and quiet: with no limiter answer the view is simply not counted", async () => {
    const p = await makeProduct({ slug: "down" });
    const broken = {
      async hit() {
        return { allowed: true, retryAfterSec: 30, unavailable: true };
      },
    };
    expect(
      await recordView(
        { slug: "down", ip: "1.1.1.1", userAgent: BROWSER, now: t0 },
        { limiter: broken },
      ),
    ).toBe("ignored");
    expect(await viewsOf(p.id)).toBe(0);
  });
  it("stores no visitor identifier anywhere", async () => {
    await makeProduct({ slug: "private" });
    await recordView(
      { slug: "private", ip: "203.0.113.77", userAgent: BROWSER, now: t0 },
      { limiter: limiter() },
    );
    const dump =
      JSON.stringify(await db().rateLimitCounter.findMany()) +
      JSON.stringify(await db().productViewDaily.findMany());
    expect(dump).not.toContain("203.0.113.77");
    expect(dump).not.toContain("Mozilla");
  });
});

describe("POST /api/products/view", () => {
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    POST(
      new Request("http://localhost/api/products/view", {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": BROWSER, ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );

  it("answers 204 and counts a real view; the same answer for an unknown product", async () => {
    const p = await makeProduct({ slug: "route-ok" });
    expect((await post({ slug: "route-ok" })).status).toBe(204);
    expect((await post({ slug: "does-not-exist" })).status).toBe(204);
    expect(await viewsOf(p.id)).toBe(1);
  });
  it("answers 204 for a bot without counting", async () => {
    const p = await makeProduct({ slug: "route-bot" });
    expect((await post({ slug: "route-bot" }, { "user-agent": "Googlebot/2.1" })).status).toBe(204);
    expect(await viewsOf(p.id)).toBe(0);
  });
  it("rejects malformed bodies with 422 and oversized ones with 413", async () => {
    expect((await post("not json")).status).toBe(422);
    expect((await post({ slug: "Bad Slug!" })).status).toBe(422);
    expect((await post({})).status).toBe(422);
    expect((await post({ slug: "a".repeat(600) })).status).toBe(413);
  });
  it("ignores a cross-origin post", async () => {
    const p = await makeProduct({ slug: "route-origin" });
    expect((await post({ slug: "route-origin" }, { origin: "https://evil.example" })).status).toBe(
      204,
    );
    expect(await viewsOf(p.id)).toBe(0);
  });
  it("answers 429 with Retry-After once one client exceeds the per-IP limit", async () => {
    await makeProduct({ slug: "route-flood" });
    let last = 204;
    let retryAfter: string | null = null;
    for (let i = 0; i < policies.viewIp.max + 5; i++) {
      const r = await post({ slug: "route-flood" });
      last = r.status;
      retryAfter = r.headers.get("retry-after");
    }
    expect(last).toBe(429);
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
  });
});
