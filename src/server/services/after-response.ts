import { after } from "next/server";
import { dispatchEmail } from "@/server/services/email.service";

/** Sends queued emails after the response (best effort; the outbox job retries anything this misses). */
export function dispatchAfterResponse(ids: string[]): void {
  if (ids.length === 0) return;
  const run = async () => {
    for (const id of ids) await dispatchEmail(id).catch(() => undefined);
  };
  try {
    after(run);
  } catch {
    void run(); // outside a request (tests, scripts)
  }
}
