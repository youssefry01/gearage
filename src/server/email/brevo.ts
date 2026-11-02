import { z } from "zod";
import type { EmailMessage, EmailProvider, SendResult } from "./types";

const ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 10_000;

const successSchema = z.object({ messageId: z.string().min(1) });
const errorSchema = z.object({ code: z.string().optional() });

export type BrevoConfig = {
  apiKey: string;
  from: { email: string; name: string };
  replyTo?: string | undefined;
  fetch?: typeof fetch;
};

/**
 * Brevo transactional email over plain HTTPS (no SDK, ADR 0022). Error text returned to callers contains only the
 * HTTP status and Brevo's short error code, never the key, the recipient or the body. 429 and 5xx and network errors
 * are retryable; 4xx (bad key, unverified sender, invalid address) are not.
 */
export function createBrevoProvider(config: BrevoConfig): EmailProvider {
  const doFetch = config.fetch ?? fetch;
  return {
    name: "brevo",
    async send(message: EmailMessage): Promise<SendResult> {
      let response: Response;
      try {
        response = await doFetch(ENDPOINT, {
          method: "POST",
          headers: {
            "api-key": config.apiKey,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            sender: config.from,
            to: [{ email: message.to }],
            ...(config.replyTo ? { replyTo: { email: config.replyTo } } : {}),
            subject: message.subject,
            htmlContent: message.html,
            textContent: message.text,
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        return { ok: false, retryable: true, reason: "network error or timeout" };
      }
      if (response.ok) {
        const parsed = successSchema.safeParse(await response.json().catch(() => null));
        return parsed.success
          ? { ok: true, messageId: parsed.data.messageId }
          : {
              ok: false,
              retryable: false,
              reason: `unexpected success reply (${response.status})`,
            };
      }
      const detail = errorSchema.safeParse(await response.json().catch(() => null));
      const code = detail.success && detail.data.code ? ` ${detail.data.code}` : "";
      return {
        ok: false,
        retryable: response.status === 429 || response.status >= 500,
        reason: `brevo ${response.status}${code}`,
      };
    },
  };
}
