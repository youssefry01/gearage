import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

/**
 * Shipping zones are not confirmed until M6a (HANDOFF launch blocker 2), so no shopper-facing message may claim
 * delivery coverage, speed or free delivery. The product page's delivery line only says that the fee and time are
 * shown at checkout. When real zones exist, relax this test deliberately, in the same change as the copy.
 */
const COVERAGE_EN =
  /across egypt|all (of )?egypt|nationwide|countrywide|everywhere|free (shipping|delivery)|same[- ]day|next[- ]day/i;
const COVERAGE_AR =
  /جميع أنحاء مصر|كل أنحاء مصر|أنحاء الجمهورية|توصيل مجاني|شحن مجاني|نفس اليوم|اليوم التالي/;

describe("delivery copy makes no coverage claim", () => {
  it("Product.deliveryBody (en, ar)", () => {
    expect(en.Product.deliveryBody).not.toMatch(COVERAGE_EN);
    expect(ar.Product.deliveryBody).not.toMatch(COVERAGE_AR);
  });
  it("still tells the shopper where the fee and time appear", () => {
    expect(en.Product.deliveryBody).toMatch(/checkout/i);
    expect(ar.Product.deliveryBody).toContain("إتمام الطلب");
  });
  it("no Product, Compare or Home message claims coverage", () => {
    for (const ns of ["Product", "Compare", "Home", "RecentlyViewed"] as const) {
      for (const [key, value] of Object.entries({ ...en[ns] })) {
        if (typeof value === "string") expect(`${ns}.${key}: ${value}`).not.toMatch(COVERAGE_EN);
      }
      for (const [key, value] of Object.entries({ ...ar[ns] })) {
        if (typeof value === "string") expect(`${ns}.${key}: ${value}`).not.toMatch(COVERAGE_AR);
      }
    }
  });
});
