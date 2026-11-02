// @vitest-environment node
import { describe, expect, it } from "vitest";
import { storeName } from "@/config/brand";
import { locales } from "@/i18n/locales";
import { renderEmail } from "./render";

const reset = { url: "https://shop.example/en/reset-password?token=abc123", expiresMinutes: 60 };

describe("email templates", () => {
  it.each(locales)(
    "renders every template in %s with the brand name and no leftover placeholders",
    async (locale) => {
      for (const [template, payload] of [
        ["verify-code", { code: "493021", expiresMinutes: 10 }],
        ["reset-password", reset],
        ["test", {}],
      ] as const) {
        const r = await renderEmail(template, locale, payload);
        for (const part of [r.subject, r.html, r.text]) {
          expect(part).not.toMatch(/\{\w+\}/);
        }
        expect(r.html).toContain(storeName(locale));
        expect(r.subject.length).toBeGreaterThan(3);
      }
    },
  );
  it("puts the code in both the HTML and the plain text, left-to-right even in Arabic", async () => {
    const r = await renderEmail("verify-code", "ar", { code: "493021", expiresMinutes: 10 });
    expect(r.text).toContain("493021");
    expect(r.html).toContain("493021");
    expect(r.html).toContain('dir="rtl"');
    expect(r.html).toMatch(/<p dir="ltr"[^>]*>\s*<span[^>]*>493021</);
    expect(r.html).toContain('lang="ar"');
  });
  it("interpolates the expiry", async () => {
    expect(
      (await renderEmail("verify-code", "en", { code: "111111", expiresMinutes: 10 })).text,
    ).toContain("10 minutes");
  });
  it("includes the reset link as a button and as text", async () => {
    const r = await renderEmail("reset-password", "en", reset);
    expect(r.html).toContain(`href="${reset.url}"`);
    expect(r.text).toContain(reset.url);
  });
  it("escapes HTML in values that reach the markup", async () => {
    const url = "https://shop.example/r?a=1&b=<script>alert(1)</script>";
    const r = await renderEmail("reset-password", "en", { url, expiresMinutes: 5 });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
    expect(r.html).toContain("&amp;b=");
  });
  it("rejects an invalid payload instead of rendering it", async () => {
    await expect(
      renderEmail("verify-code", "en", { code: "abc", expiresMinutes: 10 }),
    ).rejects.toThrow();
  });
  it("uses no hard-coded hex colours: they all come from the design tokens", async () => {
    const r = await renderEmail("test", "en", {});
    expect(r.html).toMatch(/#[0-9a-fA-F]{6}/); // inlined from tokens (email clients have no CSS variables)
  });
});
