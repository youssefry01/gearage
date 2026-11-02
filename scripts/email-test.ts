/**
 * Send ONE real test email through your configured provider, bypassing the outbox, and report exactly what happened.
 *
 *   npm run email:test -- you@example.com
 *   npm run email:test -- you@example.com --locale ar
 *
 * Reads .env. With EMAIL_PROVIDER=log it writes the email to EMAIL_LOG_DIR instead (nothing is sent). With brevo it
 * calls Brevo for real, so it needs BREVO_API_KEY and EMAIL_FROM (a sender verified in Brevo). Prints Brevo's message
 * id on success; on failure prints the HTTP status and Brevo's error code (never the key). Confirm delivery in
 * Brevo -> Transactional -> Logs, then check the inbox AND the spam folder.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ quiet: true });

async function main() {
  const { getEnv, resolveEmailProvider } = await import("@/lib/env");
  const { locales } = await import("@/i18n/locales");
  const { renderEmail } = await import("@/server/email/render");
  const { getEmailProvider } = await import("@/server/email/provider");

  const to = process.argv[2];
  if (!to || to.startsWith("--") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error("Usage: npm run email:test -- you@example.com [--locale en|ar]");
  }
  const li = process.argv.indexOf("--locale");
  const locale = (li >= 0 ? process.argv[li + 1] : "en") as (typeof locales)[number];
  if (!locales.includes(locale)) throw new Error(`--locale must be one of: ${locales.join(", ")}`);

  const env = getEnv();
  const provider = getEmailProvider();
  console.log(
    `Provider: ${resolveEmailProvider(env)}${env.EMAIL_FROM ? `, from ${env.EMAIL_FROM}` : ""}${env.EMAIL_REPLY_TO ? `, reply-to ${env.EMAIL_REPLY_TO}` : ""}`,
  );
  const rendered = await renderEmail("test", locale, {});
  const result = await provider.send({ to, ...rendered });
  if (result.ok) {
    console.log(
      `OK: accepted (${result.messageId}). Now check the inbox and the spam folder of ${to}.`,
    );
    return;
  }
  console.error(`FAILED (${result.retryable ? "temporary" : "permanent"}): ${result.reason}`);
  if (/401|unauthorized/i.test(result.reason))
    console.error("Hint: BREVO_API_KEY is wrong, revoked or from another account.");
  if (/400|invalid_parameter|sender/i.test(result.reason))
    console.error(
      "Hint: EMAIL_FROM must be a sender verified in Brevo (Senders, domains & dedicated IPs).",
    );
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
