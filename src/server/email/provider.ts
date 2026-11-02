import { brandVars } from "@/config/brand";
import { getEnv, resolveEmailProvider } from "@/lib/env";
import { createBrevoProvider } from "./brevo";
import { createLogProvider } from "./log";
import type { EmailProvider } from "./types";

let shared: EmailProvider | undefined;

/** The configured provider. In test mode this is ALWAYS the log provider, whatever .env contains. */
export function getEmailProvider(): EmailProvider {
  if (shared) return shared;
  const env = getEnv();
  if (resolveEmailProvider(env) === "brevo" && env.BREVO_API_KEY && env.EMAIL_FROM) {
    shared = createBrevoProvider({
      apiKey: env.BREVO_API_KEY,
      from: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME ?? brandVars("en").brand },
      replyTo: env.EMAIL_REPLY_TO,
    });
  } else {
    shared = createLogProvider(env.EMAIL_LOG_DIR);
  }
  return shared;
}

/** Tests only. */
export function setEmailProviderForTests(provider: EmailProvider | undefined): void {
  shared = provider;
}
