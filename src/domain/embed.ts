/**
 * Video embeds in the manufacturer showcase. The database only guarantees an https URL (CHECK); this is the
 * rendering-layer allow-list. Only YouTube (privacy-enhanced domain) is accepted, and the iframe URL is REBUILT from
 * the validated 11-character video id, never taken from the input string, so no admin-supplied URL (a typo, a
 * lookalike host, `javascript:`, extra query parameters) can reach an `<iframe src>`.
 */
export type VideoEmbed = { provider: "youtube"; id: string; src: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const WATCH_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com"]);

export function parseVideoEmbed(raw: string | null | undefined): VideoEmbed | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;

  let id: string | null = null;
  if (url.hostname === "www.youtube-nocookie.com") {
    const m = /^\/embed\/([^/]+)\/?$/.exec(url.pathname);
    id = m?.[1] ?? null;
  } else if (WATCH_HOSTS.has(url.hostname) && url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else if (WATCH_HOSTS.has(url.hostname)) {
    const m = /^\/embed\/([^/]+)\/?$/.exec(url.pathname);
    id = m?.[1] ?? null;
  } else if (url.hostname === "youtu.be") {
    const m = /^\/([^/]+)\/?$/.exec(url.pathname);
    id = m?.[1] ?? null;
  }
  if (!id || !YOUTUBE_ID.test(id)) return null;
  return { provider: "youtube", id, src: `https://www.youtube-nocookie.com/embed/${id}` };
}
