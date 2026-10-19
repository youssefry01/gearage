/**
 * Image storage abstraction (brief: "behind an image abstraction so real images can be swapped in later").
 * Products store a provider-agnostic KEY (never a hotlinked URL); the provider turns it into a URL. Providers:
 *   local       implemented (development; also serves the generated placeholders)
 *   supabase    planned for production (M10a), Supabase Storage
 *   cloudinary  planned alternative, Cloudinary free tier
 * Adding one means implementing StorageProvider; nothing else in the app changes.
 */
export type StoredObject = {
  key: string;
  url: string;
  contentType: ImageContentType;
  bytes: number;
};

export const IMAGE_CONTENT_TYPES = [
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/avif",
  "image/svg+xml",
] as const;
export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

export interface StorageProvider {
  readonly name: string;
  /** Stores an image. Fails if the key exists unless `overwrite` is true. */
  put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
    overwrite?: boolean;
  }): Promise<StoredObject>;
  /** Removes an object. Idempotent: deleting a missing key is not an error. */
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Public URL for a key. Pure: never touches the network. */
  urlFor(key: string): string;
}

export class StorageError extends Error {
  readonly code:
    "INVALID_KEY" | "INVALID_IMAGE" | "TOO_LARGE" | "EXISTS" | "NOT_IMPLEMENTED" | "IO";
  constructor(code: StorageError["code"], message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StorageError";
    this.code = code;
  }
}
