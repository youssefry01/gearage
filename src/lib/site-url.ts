/** Public base URL for metadata and absolute links. Reads APP_URL without requiring the full server env (build-safe). */
export function siteUrl(): URL {
  try {
    return new URL(process.env.APP_URL ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}
