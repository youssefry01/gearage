import { describe, expect, it } from "vitest";
import {
  assertLocalDatabaseForSeed,
  assertSafeDatabaseCommand,
  hostOf,
  isGuardedCommand,
  isLocalHost,
  UnsafeDatabaseError,
} from "./guard";

const local = "postgresql://postgres:postgres@localhost:5432/app";
const supabase =
  "postgresql://postgres.abc:pw@aws-0-eu.pooler.supabase.com:6543/postgres?pgbouncer=true";

describe("isLocalHost", () => {
  it.each(["localhost", "LOCALHOST", "127.0.0.1", "127.1.2.3", "::1", "[::1]", "db.localhost"])(
    "accepts %s",
    (h) => expect(isLocalHost(h)).toBe(true),
  );
  it.each([
    "db.supabase.co",
    "10.0.0.5",
    "192.168.1.10",
    "localhost.evil.com",
    "127.0.0.1.evil.com",
  ])("rejects %s", (h) => expect(isLocalHost(h)).toBe(false));
});

describe("hostOf", () => {
  it("parses hosts, sockets and rejects garbage", () => {
    expect(hostOf(local)).toBe("localhost");
    expect(hostOf(supabase)).toBe("aws-0-eu.pooler.supabase.com");
    expect(hostOf("postgresql:///db?host=/var/run/postgresql")).toBe("localhost");
    // Unparseable (e.g. credentials with an empty host) fails closed: treated as NOT local.
    expect(hostOf("postgresql://u:p@/db?host=/var/run/postgresql")).toBeNull();
    expect(hostOf("not a url")).toBeNull();
  });
  it("is not fooled by credentials that look like a local host", () => {
    expect(hostOf("postgresql://localhost:x@evil.example.com/db")).toBe("evil.example.com");
  });
});

describe("isGuardedCommand", () => {
  it.each([
    [["migrate", "dev"]],
    [["migrate", "dev", "--name", "x"]],
    [["migrate", "reset", "--force"]],
    [["db", "push"]],
    [["db", "seed"]],
    [["db", "execute", "--file", "x.sql"]],
    [["studio"]],
  ])("guards %j", (argv) => expect(isGuardedCommand(argv)).toBe(true));
  it.each([
    [["migrate", "deploy"]],
    [["migrate", "status"]],
    [["migrate", "diff"]],
    [["generate"]],
    [["validate"]],
    [[]],
  ])("allows %j", (argv) => expect(isGuardedCommand(argv)).toBe(false));
});

describe("assertSafeDatabaseCommand", () => {
  it("allows guarded commands on local databases", () => {
    expect(() =>
      assertSafeDatabaseCommand(["migrate", "dev"], { DATABASE_URL: local }),
    ).not.toThrow();
  });
  it("refuses guarded commands when ANY url is non-local", () => {
    expect(() =>
      assertSafeDatabaseCommand(["migrate", "dev"], { DATABASE_URL: local, DIRECT_URL: supabase }),
    ).toThrow(UnsafeDatabaseError);
    expect(() => assertSafeDatabaseCommand(["db", "push"], { DATABASE_URL: supabase })).toThrow(
      /non-local/,
    );
  });
  it("refuses an unparseable url", () => {
    expect(() =>
      assertSafeDatabaseCommand(["migrate", "reset"], { DATABASE_URL: "garbage" }),
    ).toThrow(UnsafeDatabaseError);
  });
  it("never blocks migrate deploy, even against production", () => {
    expect(() =>
      assertSafeDatabaseCommand(["migrate", "deploy"], { DIRECT_URL: supabase }),
    ).not.toThrow();
  });
  it("ignores unset urls", () => {
    expect(() => assertSafeDatabaseCommand(["migrate", "dev"], {})).not.toThrow();
  });
});

describe("assertLocalDatabaseForSeed", () => {
  it("refuses production hosts and accepts local ones", () => {
    expect(() => assertLocalDatabaseForSeed({ DATABASE_URL: supabase })).toThrow(/Refusing/);
    expect(() => assertLocalDatabaseForSeed({ DATABASE_URL: local })).not.toThrow();
  });
});
