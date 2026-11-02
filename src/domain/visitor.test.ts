import { describe, expect, it } from "vitest";
import { isLikelyBot, utcDay } from "./visitor";

describe("view tracking helpers", () => {
  it("treats real browsers as people", () => {
    for (const ua of [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0",
    ]) {
      expect(isLikelyBot(ua)).toBe(false);
    }
  });
  it("skips crawlers, headless browsers, scripts and a missing user agent", () => {
    for (const ua of [
      "Googlebot/2.1 (+http://www.google.com/bot.html)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36",
      "curl/8.5.0",
      "python-requests/2.32",
      "Mozilla/5.0 (compatible; bingbot/2.0)",
      "",
      "   ",
      null,
      undefined,
    ]) {
      expect(isLikelyBot(ua)).toBe(true);
    }
  });
  it("names the UTC day, not the local one", () => {
    expect(utcDay(new Date("2026-10-30T23:59:59Z"))).toBe("2026-10-30");
    expect(utcDay(new Date("2026-10-31T00:00:00Z"))).toBe("2026-10-31");
  });
});
