export type EmailMessage = { to: string; subject: string; html: string; text: string };

/** A provider reports what happened; it never throws for an expected failure. `retryable` drives the outbox backoff. */
export type SendResult =
  { ok: true; messageId: string } | { ok: false; retryable: boolean; reason: string };

export interface EmailProvider {
  readonly name: "brevo" | "log";
  send(message: EmailMessage): Promise<SendResult>;
}
