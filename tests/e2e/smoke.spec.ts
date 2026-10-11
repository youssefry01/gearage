import { expect, test } from "@playwright/test";

test("liveness endpoint returns the standard envelope", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { ok: boolean; data: { status: string } };
  expect(body.ok).toBe(true);
  expect(body.data.status).toBe("ok");
});

test("cron endpoints reject requests without the secret", async ({ request }) => {
  for (const path of ["/api/cron/tick", "/api/cron/daily"]) {
    expect((await request.get(path)).status()).toBe(401);
  }
});
