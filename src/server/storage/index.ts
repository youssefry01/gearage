import { resolve } from "node:path";
import { LocalStorageProvider } from "./local";
import { StorageError, type StorageProvider } from "./types";

export * from "./types";
export { imageKey, MAX_IMAGE_BYTES, sniffImageType, validateImage } from "./images";

export type StorageConfig = { provider: string; localDir?: string; publicBaseUrl?: string };

/** Builds the configured provider. Only `local` exists today; hosted providers implement StorageProvider (M10a). */
export function createStorage(config: StorageConfig): StorageProvider {
  switch (config.provider) {
    case "local":
      return new LocalStorageProvider(
        resolve(config.localDir ?? "public/uploads"),
        config.publicBaseUrl ?? "/uploads",
      );
    case "supabase":
    case "cloudinary":
      throw new StorageError(
        "NOT_IMPLEMENTED",
        `The "${config.provider}" storage provider is not implemented yet (planned for M10a). Use STORAGE_PROVIDER=local for now.`,
      );
    default:
      throw new StorageError(
        "NOT_IMPLEMENTED",
        `Unknown STORAGE_PROVIDER "${config.provider}". Expected local, supabase or cloudinary.`,
      );
  }
}
