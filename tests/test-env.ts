// Imported FIRST by every vitest setup file. Whatever is in the developer's .env, a test run:
//  - uses the log email provider (TEST_MODE also makes the code itself refuse Brevo), so it can never send real email;
//  - cannot reach Upstash (the keys are removed and TEST_MODE disables it);
//  - uses throw-away secrets, so it never touches the real pepper or auth secret.
import { tmpdir } from "node:os";
import { join } from "node:path";

const env = process.env as Record<string, string | undefined>;

env["TEST_MODE"] = "1";
env["EMAIL_PROVIDER"] = "log";
env["EMAIL_LOG_DIR"] = join(tmpdir(), `store-test-emails-${process.pid}`);
for (const key of Object.keys(env)) {
  if (key === "BREVO_API_KEY" || key.startsWith("UPSTASH_") || key.startsWith("PASSWORD_PEPPER_V"))
    delete env[key];
}
delete env["VERCEL_ENV"];
delete env["VERCEL"];
delete env["TRUST_PROXY_HEADERS"];
delete env["PASSWORD_PEPPER_CURRENT_VERSION"];
env["RATE_LIMIT_SCALE"] = "1";
env["AUTH_SECRET"] = "test-only-auth-secret-test-only-auth-secret-0001";
env["PASSWORD_PEPPER"] = "test-only-pepper-test-only-pepper-0000000001";
env["CRON_SECRET"] ??= "test-only-cron-secret-test-only-cron-secret";
env["DATABASE_URL"] ??= "postgresql://unit:unit@127.0.0.1:5432/unit_test"; // never connected to by unit tests
env["LOG_LEVEL"] ??= "error";
