import { assertSafeKey } from "./images";

/**
 * Public URL of a stored image key, as a pure string function (no filesystem, no network), so pages can import it
 * without pulling provider code into the server bundle. Same result as LocalStorageProvider.urlFor (tested).
 * Hosted providers (M10a) will derive their URL from their own base the same way.
 */
export function publicImageUrl(
  key: string,
  baseUrl: string = process.env.STORAGE_PUBLIC_BASE_URL || "/uploads",
): string {
  return `${baseUrl.replace(/\/+$/, "")}/${assertSafeKey(key).split("/").map(encodeURIComponent).join("/")}`;
}
