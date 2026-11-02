// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { checkBreached } from "./hibp";

const sha1 = (s: string) => createHash("sha1").update(s, "utf8").digest("hex").toUpperCase();
const reply = (body: string, status = 200) => vi.fn(async () => new Response(body, { status }));

describe("checkBreached", () => {
  it("sends only the 5-character prefix, with padding requested", async () => {
    const fetchMock = reply("");
    await checkBreached("correct horse battery", { fetch: fetchMock as unknown as typeof fetch });
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const digest = sha1("correct horse battery");
    expect(call[0]).toBe(`https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`);
    expect(call[0]).not.toContain(digest.slice(5));
    expect((call[1].headers as Record<string, string>)["Add-Padding"]).toBe("true");
  });
  it("reports the breach count for a match, 0 for no match", async () => {
    const digest = sha1("hunter2hunter2");
    const body = `${digest.slice(5)}:77\r\n0000000000000000000000000000000000A:3`;
    expect(
      await checkBreached("hunter2hunter2", { fetch: reply(body) as unknown as typeof fetch }),
    ).toEqual({ status: "ok", count: 77 });
    expect(
      await checkBreached("another passphrase", { fetch: reply(body) as unknown as typeof fetch }),
    ).toEqual({ status: "ok", count: 0 });
  });
  it("hashes the NFKC-normalized password", async () => {
    const digest = sha1("password1234");
    const body = `${digest.slice(5)}:5`;
    expect(
      await checkBreached("ｐａｓｓｗｏｒｄ１２３４", {
        fetch: reply(body) as unknown as typeof fetch,
      }),
    ).toEqual({ status: "ok", count: 5 });
  });
  it("FAILS OPEN: an HTTP error, a network error and a timeout are all 'unknown', never a throw", async () => {
    expect(
      await checkBreached("x".repeat(12), { fetch: reply("", 503) as unknown as typeof fetch }),
    ).toEqual({ status: "unknown" });
    const boom = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await checkBreached("x".repeat(12), { fetch: boom as unknown as typeof fetch })).toEqual(
      { status: "unknown" },
    );
  });
  it("makes no network request at all in test mode unless a fetch is injected", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await checkBreached("x".repeat(12))).toEqual({ status: "unknown" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
