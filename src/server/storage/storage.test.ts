// @vitest-environment node
import { mkdtemp, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertSafeKey, imageKey, MAX_IMAGE_BYTES, sniffImageType, validateImage } from "./images";
import { createStorage } from "./index";
import { LocalStorageProvider } from "./local";
import type { StorageError } from "./types";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]);
const WEBP = Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), 1, 2]);
const AVIF = Uint8Array.from([0, 0, 0, 24, ...Buffer.from("ftypavif"), 0, 0, 0, 0]);
const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
);

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as StorageError).code;
  }
  return undefined;
};

describe("sniffImageType (by content, not by declared type)", () => {
  it("recognizes the supported formats", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(WEBP)).toBe("image/webp");
    expect(sniffImageType(AVIF)).toBe("image/avif");
    expect(sniffImageType(SVG)).toBe("image/svg+xml");
  });
  it("rejects everything else", () => {
    expect(
      sniffImageType(new TextEncoder().encode("<html><script>alert(1)</script></html>")),
    ).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("MZ\x90\x00 an executable"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("validateImage", () => {
  it("accepts a real image whose declared type matches", () => {
    expect(validateImage(PNG, "image/png")).toEqual({ contentType: "image/png", extension: "png" });
    expect(validateImage(JPEG, "IMAGE/JPEG; charset=binary")).toEqual({
      contentType: "image/jpeg",
      extension: "jpg",
    });
  });
  it("rejects a mismatch (a script uploaded as image/png), empty files and oversized files", () => {
    expect(
      code(() => validateImage(new TextEncoder().encode("<script>alert(1)</script>"), "image/png")),
    ).toBe("INVALID_IMAGE");
    expect(code(() => validateImage(JPEG, "image/png"))).toBe("INVALID_IMAGE");
    expect(code(() => validateImage(new Uint8Array(), "image/png"))).toBe("INVALID_IMAGE");
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(PNG);
    expect(code(() => validateImage(big, "image/png"))).toBe("TOO_LARGE");
  });
  it("refuses SVG unless explicitly allowed (our own placeholders only)", () => {
    expect(code(() => validateImage(SVG, "image/svg+xml"))).toBe("INVALID_IMAGE");
    expect(validateImage(SVG, "image/svg+xml", { allowSvg: true }).extension).toBe("svg");
  });
});

describe("assertSafeKey", () => {
  it("accepts simple relative keys", () => {
    for (const ok of ["a.png", "products/abc123/main.webp", "p/1-2_3.jpg"])
      expect(assertSafeKey(ok)).toBe(ok);
  });
  it.each([
    "",
    "../secret.png",
    "a/../../b.png",
    "/etc/passwd",
    "a//b.png",
    "a\\b.png",
    "A.png",
    "a b.png",
    "a/.hidden",
    "a/..png",
    "a\0b.png",
    ".",
    "..",
    "x".repeat(201),
    "é.png",
  ])("rejects %j", (bad) => expect(code(() => assertSafeKey(bad))).toBe("INVALID_KEY"));
});

describe("imageKey", () => {
  it("is content-addressed and safe", () => {
    const a = imageKey("products/p1", PNG, "png");
    expect(a).toMatch(/^products\/p1\/[0-9a-f]{20}\.png$/);
    expect(imageKey("products/p1", PNG, "png")).toBe(a);
    expect(imageKey("products/p1", JPEG, "png")).not.toBe(a);
    expect(code(() => imageKey("../x", PNG, "png"))).toBe("INVALID_KEY");
  });
});

describe("LocalStorageProvider", () => {
  let dir: string;
  let storage: LocalStorageProvider;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "storage-test-"));
    storage = new LocalStorageProvider(dir, "/uploads");
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("stores, reads back, reports existence and builds URLs", async () => {
    const key = imageKey("products/p1", PNG, "png");
    const stored = await storage.put({ key, body: PNG, contentType: "image/png" });
    expect(stored).toMatchObject({
      key,
      contentType: "image/png",
      bytes: PNG.byteLength,
      url: `/uploads/${key}`,
    });
    expect(new Uint8Array(await readFile(join(dir, key)))).toEqual(PNG);
    expect(await storage.exists(key)).toBe(true);
    expect(await storage.exists("products/p1/missing.png")).toBe(false);
  });
  it("leaves no temp files behind", async () => {
    await storage.put({ key: "a/one.png", body: PNG, contentType: "image/png" });
    expect(await readdir(join(dir, "a"))).toEqual(["one.png"]);
  });
  it("refuses to overwrite unless asked", async () => {
    await storage.put({ key: "a/one.png", body: PNG, contentType: "image/png" });
    await expect(
      storage.put({ key: "a/one.png", body: PNG, contentType: "image/png" }),
    ).rejects.toMatchObject({ code: "EXISTS" });
    await storage.put({
      key: "a/one.png",
      body: Uint8Array.from([...PNG, 9]),
      contentType: "image/png",
      overwrite: true,
    });
  });
  it("deletes idempotently", async () => {
    await storage.put({ key: "a/one.png", body: PNG, contentType: "image/png" });
    await storage.delete("a/one.png");
    await storage.delete("a/one.png");
    expect(await storage.exists("a/one.png")).toBe(false);
  });
  it("rejects traversal keys and mismatched extensions before touching the disk", async () => {
    await expect(
      storage.put({ key: "../escape.png", body: PNG, contentType: "image/png" }),
    ).rejects.toMatchObject({ code: "INVALID_KEY" });
    await expect(
      storage.put({ key: "a/photo.jpg", body: PNG, contentType: "image/png" }),
    ).rejects.toMatchObject({ code: "INVALID_KEY" });
    await expect(
      storage.put({
        key: "a/x.png",
        body: new TextEncoder().encode("<script>"),
        contentType: "image/png",
      }),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    await expect(storage.exists("../escape.png")).rejects.toMatchObject({ code: "INVALID_KEY" });
    await expect(storage.delete("../escape.png")).rejects.toMatchObject({ code: "INVALID_KEY" });
  });
  it("allows SVG only when configured (generated placeholders)", async () => {
    await expect(
      storage.put({ key: "ph/x.svg", body: SVG, contentType: "image/svg+xml" }),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    const svgStorage = new LocalStorageProvider(dir, "/uploads", { allowSvg: true });
    expect(
      (await svgStorage.put({ key: "ph/x.svg", body: SVG, contentType: "image/svg+xml" }))
        .contentType,
    ).toBe("image/svg+xml");
  });
  it("normalizes the base URL", () => {
    expect(new LocalStorageProvider(dir, "https://cdn.example/img//").urlFor("a/b.png")).toBe(
      "https://cdn.example/img/a/b.png",
    );
  });
});

describe("createStorage", () => {
  it("builds the local provider", () => {
    expect(createStorage({ provider: "local", localDir: tmpdir() }).name).toBe("local");
  });
  it("is explicit about hosted providers not being implemented yet, and about unknown ones", () => {
    expect(code(() => createStorage({ provider: "supabase" }))).toBe("NOT_IMPLEMENTED");
    expect(code(() => createStorage({ provider: "cloudinary" }))).toBe("NOT_IMPLEMENTED");
    expect(code(() => createStorage({ provider: "ftp" }))).toBe("NOT_IMPLEMENTED");
  });
});
