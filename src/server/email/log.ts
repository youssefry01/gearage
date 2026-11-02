import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { logger } from "@/lib/logger";
import type { EmailMessage, EmailProvider, SendResult } from "./types";

/**
 * Development and test transport: nothing leaves the machine. Each email becomes `<dir>/<time>-<id>.json` (data for
 * tests) and `.html` (open it in a browser), and its plain text is printed to the server log, so you can copy the
 * code or link. The directory is gitignored. This provider is refused in production (lib/env.ts).
 */
export function createLogProvider(dir: string): EmailProvider {
  return {
    name: "log",
    async send(message: EmailMessage): Promise<SendResult> {
      const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
      const base = join(resolve(dir), id);
      try {
        await mkdir(resolve(dir), { recursive: true });
        await writeFile(`${base}.json`, JSON.stringify(message, null, 2), "utf8");
        await writeFile(`${base}.html`, message.html, "utf8");
      } catch (err) {
        return {
          ok: false,
          retryable: false,
          reason: `could not write ${dir}: ${err instanceof Error ? err.message : "error"}`,
        };
      }
      logger.info("email_logged", {
        to: message.to,
        subject: message.subject,
        file: `${base}.html`,
      });
      console.log(
        `\n--- email (log provider) to ${message.to}: ${message.subject}\n${message.text}\n---\n`,
      );
      return { ok: true, messageId: `log-${id}` };
    },
  };
}
