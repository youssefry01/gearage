// @vitest-environment node
import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/locales";
import { renderEmail } from "./render";

const cancelUrl = "https://shop.example/en/email-change/cancel#token=" + "A".repeat(43);
const payloads = {
  "email-change-code": { code: "049213", expiresMinutes: 30 },
  "email-change-notice": {
    newEmailMasked: "j***@example.com",
    cancelUrl,
    device: "chrome/windows",
    expiresMinutes: 30,
  },
  "email-changed": {
    newEmailMasked: "j***@example.com",
    contactUrl: "https://shop.example/en/contact",
  },
  "email-change-taken": {},
} as const;

describe("email-change templates", () => {
  it.each(locales)("render in %s with no leftover placeholders", async (locale) => {
    for (const [template, payload] of Object.entries(payloads)) {
      const r = await renderEmail(template as keyof typeof payloads, locale, payload);
      for (const part of [r.subject, r.html, r.text]) expect(part, template).not.toMatch(/\{\w+\}/);
    }
  });

  it("the notice to the OLD address carries the cancel link and only the masked new address", async () => {
    const r = await renderEmail("email-change-notice", "en", payloads["email-change-notice"]);
    expect(r.text).toContain(cancelUrl);
    expect(r.html).toContain(cancelUrl);
    expect(r.text).toContain("j***@example.com");
    expect(r.text).toContain("Chrome on Windows");
  });

  it("the code email carries the code, with leading zeros, and no address at all", async () => {
    const r = await renderEmail("email-change-code", "en", payloads["email-change-code"]);
    expect(r.text).toContain("049213");
    expect(r.text).not.toMatch(/@/);
  });

  it("isolates the address from right-to-left text in Arabic", async () => {
    const r = await renderEmail("email-changed", "ar", payloads["email-changed"]);
    expect(r.text).toContain("\u2066j***@example.com\u2069");
  });

  it("a password reset notice says every device was signed out; a change says this one stayed", async () => {
    const base = { device: null, resetUrl: "https://shop.example/en/forgot-password" };
    const viaReset = await renderEmail("password-changed", "en", { ...base, method: "reset" });
    const viaChange = await renderEmail("password-changed", "en", { ...base, method: "change" });
    const legacy = await renderEmail("password-changed", "en", base);
    expect(viaReset.text).toContain("Every device that was signed in");
    expect(viaReset.text).not.toContain("This device stayed signed in");
    expect(viaChange.text).toContain("This device stayed signed in");
    expect(legacy.text).toBe(viaChange.text);
  });
});
