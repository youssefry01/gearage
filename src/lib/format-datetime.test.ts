import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatTime } from "./format-datetime";

// Egypt's clock is what the account area shows, whatever the server's or the browser's zone is. The instants below are
// chosen around Cairo's UTC+2 (winter) and UTC+3 (summer time, in force again since 2023).
describe("account date formatting (Cairo time, page language, Western digits)", () => {
  const winter = new Date("2026-01-15T22:30:00Z"); // 00:30 on the 16th in Cairo
  const summer = new Date("2026-07-15T20:45:00Z"); // 23:45 on the 15th in Cairo (UTC+3)

  it('"Signed in" shows date AND time in Cairo time', () => {
    expect(formatDateTime(winter, "en")).toMatch(/^Jan 16, 2026.*12:30\s?AM$/);
    expect(formatDateTime(summer, "en")).toMatch(/^Jul 15, 2026.*11:45\s?PM$/);
  });

  it('"Last active" shows the date only', () => {
    expect(formatDate(winter, "en")).toBe("Jan 16, 2026");
    expect(formatDate(winter, "en")).not.toMatch(/\d:\d/);
  });

  it("follows the page language but keeps Western digits in Arabic", () => {
    const ar = formatDateTime(winter, "ar");
    expect(ar).toMatch(/16/);
    expect(ar).not.toMatch(/[\u0660-\u0669]/); // no Arabic-Indic digits
    expect(ar).not.toMatch(/Jan/); // month names are Arabic
    expect(formatDate(winter, "ar")).not.toMatch(/[\u0660-\u0669]/);
  });

  it("is independent of the process time zone", () => {
    const before = formatTime(winter, "en");
    const original = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Kiritimati";
      expect(formatTime(winter, "en")).toBe(before);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});
