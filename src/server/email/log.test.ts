// @vitest-environment node
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogProvider } from "./log";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "log-provider-"));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

describe("log provider", () => {
  it("writes a .json and a .html file per email and returns a log message id", async () => {
    const r = await createLogProvider(dir).send({
      to: "a@example.com",
      subject: "S",
      html: "<b>x</b>",
      text: "x",
    });
    expect(r).toMatchObject({ ok: true });
    const files = (await readdir(dir)).sort();
    expect(files).toHaveLength(2);
    const json = JSON.parse(
      await readFile(
        join(
          dir,
          files.find((f) => f.endsWith(".json"))!,
        ),
        "utf8",
      ),
    ) as { to: string; text: string };
    expect(json).toMatchObject({ to: "a@example.com", text: "x" });
    expect(
      await readFile(
        join(
          dir,
          files.find((f) => f.endsWith(".html"))!,
        ),
        "utf8",
      ),
    ).toBe("<b>x</b>");
  });
  it("reports a permanent failure instead of throwing when the folder cannot be written", async () => {
    const r = await createLogProvider(join(dir, "\u0000bad")).send({
      to: "a@example.com",
      subject: "S",
      html: "",
      text: "",
    });
    expect(r).toMatchObject({ ok: false, retryable: false });
  });
});
