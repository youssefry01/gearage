import type * as ReactModule from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const order: string[] = [];
const getSessionApi = vi.fn(async () => null);

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => {
    order.push("headers");
    return new Headers();
  }),
}));
vi.mock("./auth", () => ({
  getAuth: vi.fn(() => {
    order.push("getAuth");
    return { api: { getSession: getSessionApi } };
  }),
}));
vi.mock("react", async (orig) => ({
  ...(await orig<typeof ReactModule>()),
  // Memoization per request is React's job; each test needs a fresh call.
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

describe("getSession ordering (build with no environment)", () => {
  beforeEach(() => {
    order.length = 0;
    vi.clearAllMocks();
  });

  it("reads the request headers before it touches the auth configuration", async () => {
    const { getSession } = await import("./session");
    await getSession();
    expect(order).toEqual(["headers", "getAuth"]);
  });

  it("never builds the auth instance when headers() signals dynamic rendering", async () => {
    const next = await import("next/headers");
    vi.mocked(next.headers).mockImplementationOnce(async () => {
      order.push("headers");
      throw new Error("DYNAMIC_SERVER_USAGE");
    });
    const { getSession } = await import("./session");
    await expect(getSession()).rejects.toThrow("DYNAMIC_SERVER_USAGE");
    expect(order).toEqual(["headers"]);
  });
});
