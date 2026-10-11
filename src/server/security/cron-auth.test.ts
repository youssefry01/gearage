import { describe, expect, it } from "vitest";
import { isValidCronRequest } from "@/server/security/cron-auth";

const secret = "s".repeat(40);

describe("isValidCronRequest", () => {
  it("accepts the exact bearer secret", () => {
    expect(isValidCronRequest(`Bearer ${secret}`, secret)).toBe(true);
  });
  it.each([null, "", "Bearer ", `Bearer ${secret}x`, `bearer ${secret}`, secret, "Bearer wrong"])(
    "rejects %j",
    (header) => {
      expect(isValidCronRequest(header, secret)).toBe(false);
    },
  );
});
