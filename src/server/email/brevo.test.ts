// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createBrevoProvider } from "./brevo";

const msg = { to: "buyer@example.com", subject: "Hello", html: "<p>hi</p>", text: "hi" };
const config = {
  apiKey: "xkeysib-secret-key-1234567890",
  from: { email: "shop@example.com", name: "Shop" },
};
const json = (body: unknown, status: number) =>
  vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );

describe("brevo provider", () => {
  it("posts the documented payload with the api-key header", async () => {
    const f = json({ messageId: "<abc@smtp-relay.brevo.com>" }, 201);
    const provider = createBrevoProvider({
      ...config,
      replyTo: "help@example.com",
      fetch: f as unknown as typeof fetch,
    });
    expect(await provider.send(msg)).toEqual({ ok: true, messageId: "<abc@smtp-relay.brevo.com>" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe(config.apiKey);
    expect(JSON.parse(init.body as string)).toEqual({
      sender: config.from,
      to: [{ email: "buyer@example.com" }],
      replyTo: { email: "help@example.com" },
      subject: "Hello",
      htmlContent: "<p>hi</p>",
      textContent: "hi",
    });
  });
  it("omits replyTo when none is configured", async () => {
    const f = json({ messageId: "m" }, 201);
    await createBrevoProvider({ ...config, fetch: f as unknown as typeof fetch }).send(msg);
    expect(
      JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string),
    ).not.toHaveProperty("replyTo");
  });
  it("classifies failures: 401/400 are permanent, 429/5xx/network are retryable", async () => {
    const run = (status: number, body: unknown) =>
      createBrevoProvider({ ...config, fetch: json(body, status) as unknown as typeof fetch }).send(
        msg,
      );
    expect(await run(401, { code: "unauthorized", message: "Key not found" })).toEqual({
      ok: false,
      retryable: false,
      reason: "brevo 401 unauthorized",
    });
    expect(await run(400, { code: "invalid_parameter" })).toMatchObject({
      ok: false,
      retryable: false,
    });
    expect(await run(429, { code: "too_many_requests" })).toMatchObject({
      ok: false,
      retryable: true,
    });
    expect(await run(503, {})).toMatchObject({ ok: false, retryable: true, reason: "brevo 503" });
    const down = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    expect(
      await createBrevoProvider({ ...config, fetch: down as unknown as typeof fetch }).send(msg),
    ).toMatchObject({ ok: false, retryable: true });
  });
  it("never leaks the key, the recipient or the body into an error reason", async () => {
    const r = await createBrevoProvider({
      ...config,
      fetch: json(
        { code: "unauthorized", message: `bad key ${config.apiKey} for buyer@example.com` },
        401,
      ) as unknown as typeof fetch,
    }).send(msg);
    const text = JSON.stringify(r);
    expect(text).not.toContain(config.apiKey);
    expect(text).not.toContain("buyer@example.com");
  });
  it("treats a 2xx without a message id as a permanent failure", async () => {
    const r = await createBrevoProvider({
      ...config,
      fetch: json({}, 201) as unknown as typeof fetch,
    }).send(msg);
    expect(r).toMatchObject({ ok: false, retryable: false });
  });
});
