import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccountStateStore } from "./account-state-store";

const answer = (data: unknown) =>
  Promise.resolve(new Response(JSON.stringify({ ok: true, data }), { status: 200 }));

beforeEach(() => {
  useAccountStateStore.setState({ status: "unknown", name: "", initial: "" });
});
afterEach(() => vi.unstubAllGlobals());

describe("account state store", () => {
  it("starts unknown and learns signed-in and signed-out from the endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => answer({ signedIn: true, name: "Mona", initial: "M" }))
      .mockImplementationOnce(() => answer({ signedIn: false }));
    vi.stubGlobal("fetch", fetchMock);
    expect(useAccountStateStore.getState().status).toBe("unknown");
    await useAccountStateStore.getState().refresh();
    expect(useAccountStateStore.getState()).toMatchObject({
      status: "signed-in",
      name: "Mona",
      initial: "M",
    });
    await useAccountStateStore.getState().refresh();
    expect(useAccountStateStore.getState()).toMatchObject({ status: "signed-out", name: "" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/state",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("keeps what it knew when a check fails (limit, outage, nonsense, offline)", async () => {
    useAccountStateStore.setState({ status: "signed-in", name: "Mona", initial: "M" });
    for (const failing of [
      () => Promise.resolve(new Response("{}", { status: 429 })),
      () => Promise.resolve(new Response("not json", { status: 200 })),
      () => Promise.resolve(new Response(JSON.stringify({ ok: true, data: { x: 1 } }))),
      () => Promise.reject(new Error("offline")),
    ]) {
      vi.stubGlobal("fetch", vi.fn(failing));
      await useAccountStateStore.getState().refresh();
      expect(useAccountStateStore.getState().status).toBe("signed-in");
    }
  });

  it("merges overlapping refreshes, then asks once more so the newest answer wins", async () => {
    let release!: (r: Response) => void;
    const first = new Promise<Response>((r) => (release = r));
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(() => answer({ signedIn: true, name: "Mona", initial: "M" }));
    vi.stubGlobal("fetch", fetchMock);
    const a = useAccountStateStore.getState().refresh();
    const b = useAccountStateStore.getState().refresh();
    release(new Response(JSON.stringify({ ok: true, data: { signedIn: false } })));
    await Promise.all([a, b]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useAccountStateStore.getState().status).toBe("signed-in");
  });
});
