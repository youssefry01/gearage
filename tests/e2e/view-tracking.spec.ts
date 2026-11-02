import { expect, test } from "./fixtures";

// Needs the seeded catalog. View counting is anonymous (ADR 0023): the page sends the slug and nothing else.

const PART = "amd-ryzen-5-7600-processor";

test.describe("anonymous view tracking", () => {
  test("a product page reports one view with only the slug, and sets no cookie", async ({
    page,
  }) => {
    const reported = page.waitForRequest(
      (r) => r.url().endsWith("/api/products/view") && r.method() === "POST",
    );
    const answered = page.waitForResponse((r) => r.url().endsWith("/api/products/view"));
    await page.goto(`/en/p/${PART}`);
    const request = await reported;
    expect(request.postDataJSON()).toEqual({ slug: PART });
    const response = await answered;
    expect(response.status()).toBe(204);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });

  test("the endpoint validates its input and never reveals what it did", async ({ request }) => {
    const ok = await request.post("/api/products/view", { data: { slug: PART } });
    expect(ok.status()).toBe(204);
    const unknown = await request.post("/api/products/view", { data: { slug: "no-such-product" } });
    expect(unknown.status()).toBe(204); // same answer as a real product
    const bad = await request.post("/api/products/view", { data: { slug: "Not A Slug" } });
    expect(bad.status()).toBe(422);
    expect(await bad.json()).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
  });

  test("a category page does not report a view", async ({ page }) => {
    let posted = false;
    page.on("request", (r) => {
      if (r.url().endsWith("/api/products/view")) posted = true;
    });
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    expect(posted).toBe(false);
  });
});
