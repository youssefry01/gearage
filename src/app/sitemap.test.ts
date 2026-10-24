import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/services/category.service", () => ({ getCategoryTree: vi.fn() }));
vi.mock("@/server/services/product.service", () => ({ listPublicProductSlugs: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { getCategoryTree } from "@/server/services/category.service";
import { listPublicProductSlugs } from "@/server/services/product.service";
import { resetSitemapService } from "@/server/services/sitemap.service";
import sitemap, { dynamic } from "./sitemap";

describe("GET /sitemap.xml (the route function)", () => {
  beforeEach(() => resetSitemapService());

  it("is dynamic, so a degraded answer is never frozen into a cached page", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns the minimal sitemap instead of throwing when the database fails (was a 500)", async () => {
    vi.mocked(getCategoryTree).mockRejectedValue(new Error("Can't reach database server"));
    vi.mocked(listPublicProductSlugs).mockRejectedValue(new Error("Can't reach database server"));
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => !e.url.includes("/p/") && !e.url.includes("/c/"))).toBe(true);
  });

  it("includes product pages in every locale when the database works", async () => {
    vi.mocked(getCategoryTree).mockResolvedValue([]);
    vi.mocked(listPublicProductSlugs).mockResolvedValue(["ryzen-5-7600"]);
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/en/p/ryzen-5-7600"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/ar/p/ryzen-5-7600"))).toBe(true);
  });
});
