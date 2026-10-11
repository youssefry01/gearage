import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultContactSettings } from "@/domain/store-settings";
import { readSetting } from "@/server/repositories/store-settings.repository";
import { getContactSettings } from "./store-settings.service";

vi.mock("@/server/repositories/store-settings.repository", () => ({ readSetting: vi.fn() }));
const read = vi.mocked(readSetting);

describe("getContactSettings", () => {
  beforeEach(() => {
    read.mockReset();
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
});
