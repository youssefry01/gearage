import { describe, expect, it } from "vitest";
import {
  contactSettingsSchema,
  defaultContactSettings,
  defaultTopBarSettings,
  resolveTopBarLines,
  topBarSettingsSchema,
} from "./store-settings";

describe("contactSettingsSchema", () => {
  it("parses an empty object into all-null defaults", () => {
    expect(contactSettingsSchema.parse({})).toEqual(defaultContactSettings);
    expect(defaultContactSettings.social.facebook).toBeNull();
  });
  it("accepts valid details", () => {
    const parsed = contactSettingsSchema.parse({
      email: "hello@example.com",
      phone: "+20 100 123 4567",
      address: { en: "1 Example St, Cairo" },
      social: { instagram: "https://instagram.com/example" },
    });
    expect(parsed.social.instagram).toBe("https://instagram.com/example");
  });
  it.each(["javascript:alert(1)", "http://insecure.example.com", "data:text/html,x", "not a url"])(
    "rejects non-https social url %s",
    (url) =>
      expect(contactSettingsSchema.safeParse({ social: { facebook: url } }).success).toBe(false),
  );
  it("rejects bad email and phone, and unknown keys", () => {
    expect(contactSettingsSchema.safeParse({ email: "nope" }).success).toBe(false);
    expect(contactSettingsSchema.safeParse({ phone: "abc" }).success).toBe(false);
    expect(contactSettingsSchema.safeParse({ surprise: 1 }).success).toBe(false);
  });
});

describe("topBarSettingsSchema (no claim is hardcoded: empty until the owner sets one)", () => {
  it("defaults to NO lines", () => {
    expect(defaultTopBarSettings.lines).toEqual([]);
    expect(topBarSettingsSchema.parse({}).lines).toEqual([]);
  });
  it("accepts up to three lines with per-locale text and defaults the icon", () => {
    const parsed = topBarSettingsSchema.parse({
      lines: [{ text: { en: "Hello" } }, { icon: "truck", text: { en: "A", ar: "ب" } }],
    });
    expect(parsed.lines[0]?.icon).toBe("info");
    expect(parsed.lines[1]?.icon).toBe("truck");
    expect(
      topBarSettingsSchema.safeParse({ lines: Array(4).fill({ text: { en: "x" } }) }).success,
    ).toBe(false);
  });
  it.each([
    [{ lines: [{ text: {} }] }],
    [{ lines: [{ text: { en: "" } }] }],
    [{ lines: [{ text: { en: "x".repeat(121) } }] }],
    [{ lines: [{ icon: "skull", text: { en: "x" } }] }],
    [{ lines: [], extra: 1 }],
  ])("rejects %j", (value) => expect(topBarSettingsSchema.safeParse(value).success).toBe(false));
});

describe("resolveTopBarLines", () => {
  const settings = topBarSettingsSchema.parse({
    lines: [
      { icon: "truck", text: { en: "English only" } },
      { icon: "banknote", text: { en: "Both", ar: "كلاهما" } },
    ],
  });
  it("uses the active locale, falls back to English, and skips lines with no usable text", () => {
    expect(resolveTopBarLines(settings, "ar")).toEqual([
      { icon: "truck", text: "English only" },
      { icon: "banknote", text: "كلاهما" },
    ]);
    expect(
      resolveTopBarLines(topBarSettingsSchema.parse({ lines: [{ text: { ar: "ب" } }] }), "en"),
    ).toEqual([]);
    expect(resolveTopBarLines(defaultTopBarSettings, "en")).toEqual([]);
  });
});
