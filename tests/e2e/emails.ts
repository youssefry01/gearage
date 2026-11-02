import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect } from "@playwright/test";

/** The "log" email provider (EMAIL_LOG_DIR in playwright.config.ts) writes every message here as JSON. */
const dir = resolve("tests/.emails");

export type LoggedEmail = { to: string; subject: string; html: string; text: string };

/** Every logged email to `to`, oldest first. */
export async function emailsFor(to: string): Promise<LoggedEmail[]> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return [];
  }
  const out: LoggedEmail[] = [];
  for (const name of names) {
    const mail = JSON.parse(await readFile(join(dir, name), "utf8")) as LoggedEmail;
    if (mail.to.toLowerCase() === to.toLowerCase()) out.push(mail);
  }
  return out;
}

/** Waits until at least `count` emails to `to` exist (dispatch happens after the response) and returns the newest. */
export async function waitForEmail(to: string, count = 1): Promise<LoggedEmail> {
  let all: LoggedEmail[] = [];
  await expect
    .poll(async () => (all = await emailsFor(to)).length, { message: `no email for ${to}` })
    .toBeGreaterThanOrEqual(count);
  return all[all.length - 1]!;
}

/** The 6-digit code in a verification email's plain-text part. */
export function codeFrom(mail: LoggedEmail): string {
  const m = /\b(\d{6})\b/.exec(mail.text);
  if (!m) throw new Error("no 6-digit code in email");
  return m[1]!;
}

/** The first link to the reset-password page in an email. */
export function resetLinkFrom(mail: LoggedEmail): string {
  const m = /https?:\/\/[^\s"<>]+\/reset-password#token=[^\s"<>]+/.exec(mail.text);
  if (!m) throw new Error("no reset link in email");
  return m[0];
}
