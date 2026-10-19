import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { assertSafeKey, validateImage } from "./images";
import { StorageError, type StorageProvider, type StoredObject } from "./types";

/**
 * Stores images on the local disk (development and tests). NOT for Vercel production (read-only, per-instance file
 * system): production uses a hosted provider. Writes are atomic (temp file then rename) and always stay inside `root`.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  private readonly root: string;

  constructor(
    rootDir: string,
    private readonly publicBaseUrl = "/uploads",
    private readonly options: { allowSvg?: boolean } = {},
  ) {
    this.root = resolve(rootDir);
  }

  private pathFor(key: string): string {
    const path = resolve(this.root, assertSafeKey(key));
    if (!path.startsWith(this.root + sep))
      throw new StorageError("INVALID_KEY", "Key escapes the storage root");
    return path;
  }

  async put({
    key,
    body,
    contentType,
    overwrite = false,
  }: Parameters<StorageProvider["put"]>[0]): Promise<StoredObject> {
    const path = this.pathFor(key);
    const image = validateImage(body, contentType, this.options);
    if (!key.endsWith(`.${image.extension}`)) {
      throw new StorageError(
        "INVALID_KEY",
        `The key must end in .${image.extension} for a ${image.contentType} image`,
      );
    }
    if (!overwrite && (await this.exists(key)))
      throw new StorageError("EXISTS", `"${key}" already exists`);
    try {
      await mkdir(dirname(path), { recursive: true });
      const temp = `${path}.${randomUUID()}.tmp`;
      await writeFile(temp, body);
      await rename(temp, path);
    } catch (cause) {
      throw new StorageError("IO", "Could not write the file", { cause });
    }
    return { key, url: this.urlFor(key), contentType: image.contentType, bytes: body.byteLength };
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await stat(this.pathFor(key))).isFile();
    } catch (err) {
      if (err instanceof StorageError) throw err;
      return false;
    }
  }

  urlFor(key: string): string {
    return `${this.publicBaseUrl.replace(/\/+$/, "")}/${assertSafeKey(key).split("/").map(encodeURIComponent).join("/")}`;
  }
}
