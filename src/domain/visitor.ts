/** View-tracking helpers (ADR 0023). Pure: no I/O, no secrets. */

const BOT =
  /bot|crawl|spider|slurp|headless|preview|fetch|monitor|lighthouse|python-requests|curl|wget|httpclient|axios|node-fetch|go-http|java\//i;

/** Obvious automation. A missing user agent counts as a bot. */
export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim() === "") return true;
  return BOT.test(userAgent);
}

/** UTC calendar day, `YYYY-MM-DD`. The visitor hash key rotates with it. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}
