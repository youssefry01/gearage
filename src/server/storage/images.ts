import { createHash } from "node:crypto";
import { StorageError, type ImageContentType } from "./types";

/** Largest upload accepted (5 MB). Product photos are optimized with next/image at render time. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<ImageContentType, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);
const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.slice(from, to));

/** Identifies an image by its CONTENT (magic bytes). The client-supplied content type is never trusted. */
export function sniffImageType(bytes: Uint8Array): ImageContentType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (ascii(bytes, 4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 12)))
    return "image/avif";
  const head = new TextDecoder().decode(bytes.slice(0, 256)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg")))
    return "image/svg+xml";
  return null;
}

export type ValidatedImage = { contentType: ImageContentType; extension: string };

/**
 * Checks size and real content type. SVG is refused unless `allowSvg` (SVG can carry scripts; only our own generated
 * placeholders are allowed to be SVG, never admin uploads). The declared type must match what the bytes really are.
 */
export function validateImage(
  body: Uint8Array,
  declaredType: string,
  { allowSvg = false } = {},
): ValidatedImage {
  if (body.byteLength === 0) throw new StorageError("INVALID_IMAGE", "The file is empty");
  if (body.byteLength > MAX_IMAGE_BYTES)
    throw new StorageError(
      "TOO_LARGE",
      `Images are limited to ${MAX_IMAGE_BYTES / 1024 / 1024} MB`,
    );
  const detected = sniffImageType(body);
  if (!detected)
    throw new StorageError(
      "INVALID_IMAGE",
      "The file is not a supported image (WebP, JPEG, PNG or AVIF)",
    );
  if (detected === "image/svg+xml" && !allowSvg)
    throw new StorageError("INVALID_IMAGE", "SVG uploads are not allowed");
  if (detected !== declaredType.toLowerCase().split(";")[0]?.trim()) {
    throw new StorageError(
      "INVALID_IMAGE",
      `The file is ${detected} but was declared as ${declaredType}`,
    );
  }
  return { contentType: detected, extension: EXTENSIONS[detected] };
}

const SEGMENT = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const MAX_KEY_LENGTH = 200;

/** Keys are relative, forward-slash paths of simple lowercase segments: no traversal, no absolute paths, no surprises. */
export function assertSafeKey(key: string): string {
  if (!key || key.length > MAX_KEY_LENGTH)
    throw new StorageError("INVALID_KEY", "Invalid storage key length");
  const segments = key.split("/");
  if (segments.some((s) => !SEGMENT.test(s) || s === "." || s === ".." || s.includes(".."))) {
    throw new StorageError("INVALID_KEY", `Invalid storage key "${key.slice(0, 60)}"`);
  }
  return key;
}

/** Content-addressed key: identical bytes always map to the same key (free de-duplication, cache-friendly URLs). */
export function imageKey(scope: string, body: Uint8Array, extension: string): string {
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 20);
  return assertSafeKey(`${scope}/${hash}.${extension}`);
}
