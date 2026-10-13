import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultContactSettings } from "@/domain/store-settings";
import { readSetting } from "@/server/repositories/store-settings.repository";
import { logger } from "@/lib/logger";
import { getContactSettings, resetStoreSettingsWarningsForTests } from "./store-settings.service";

vi.mock("@/server/repositories/store-settings.repository", () => ({ readSetting: vi.fn() }));
const read = vi.mocked(readSetting);

describe("getContactSettings", () => {
  beforeEach(() => {
    read.mockReset();
    resetStoreSettingsWarningsForTests();
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/x");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("returns defaults when nothing is saved", async () => {
    read.mockResolvedValue(null);
    expect(await getContactSettings()).toEqual(defaultContactSettings);
  });
  it("returns saved values", async () => {
    read.mockResolvedValue({ email: "a@b.co", social: { x: "https://x.com/store" } });
    const s = await getContactSettings();
    expect(s.email).toBe("a@b.co");
    expect(s.social.x).toBe("https://x.com/store");
  });
  it("falls back to defaults on invalid stored data", async () => {
    read.mockResolvedValue({ social: { facebook: "javascript:alert(1)" } });
    expect(await getContactSettings()).toEqual(defaultContactSettings);
  });
  it("falls back to defaults when the database is unreachable", async () => {
    read.mockRejectedValue(new Error("connection refused"));
    expect(await getContactSettings()).toEqual(defaultContactSettings);
  });

  it("returns defaults quietly, without touching the database, when DATABASE_URL is not set (CI builds)", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(await getContactSettings()).toEqual(defaultContactSettings);
    expect(read).not.toHaveBeenCalled();
  });
  it("warns at most once a minute and never logs a stack trace", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    read.mockRejectedValue(new Error("connection refused"));
    for (let i = 0; i < 50; i++) await getContactSettings();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls[0])).not.toContain("stack");
  });
});
