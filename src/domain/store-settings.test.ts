import { describe, expect, it } from "vitest";
import { contactSettingsSchema, defaultContactSettings } from "./store-settings";

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
