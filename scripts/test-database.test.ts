import { describe, expect, it } from "vitest";
import { UnsafeDatabaseError } from "../prisma/guard";
import { brand } from "../src/config/brand";
import {
  DEFAULT_TEST_DATABASE,
  resolveTestDatabase,
  UnsafeTestDatabaseError,
} from "./lib/test-database";

const TEST_DB = DEFAULT_TEST_DATABASE;
const DEV_DB = brand.slug; // the development database is named after the brand slug
const dev = `postgresql://dev:secret@localhost:5432/${DEV_DB}`;

describe("resolveTestDatabase: which database npm run test:db may touch", () => {
  it("derives the default test database from the dev URL on the same local server and credentials", () => {
    const t = resolveTestDatabase({ DATABASE_URL: dev });
    expect(t.database).toBe(TEST_DB);
    expect(TEST_DB).toBe(`${brand.slug}_test`);
    expect(t.url).toBe(`postgresql://dev:secret@localhost:5432/${TEST_DB}`);
    expect(t.adminUrl).toBe("postgresql://dev:secret@localhost:5432/postgres");
  });
  it("falls back to a local default when nothing is configured", () => {
    expect(resolveTestDatabase({}).database).toBe(TEST_DB);
  });
  it("uses TEST_DATABASE_URL when given (CI), including a non-default port", () => {
    const url = "postgresql://ci:ci@127.0.0.1:55432/shop_test";
    const t = resolveTestDatabase({ TEST_DATABASE_URL: url, DATABASE_URL: dev });
    expect(t).toMatchObject({ database: "shop_test", url });
  });
  it("REFUSES a non-local host, whichever variable supplied it", () => {
    const remote = "postgresql://u:p@db.supabase.co:5432/postgres";
    expect(() => resolveTestDatabase({ DATABASE_URL: remote })).toThrow(UnsafeDatabaseError);
    expect(() =>
      resolveTestDatabase({ TEST_DATABASE_URL: "postgresql://u:p@db.supabase.co:5432/app_test" }),
    ).toThrow(UnsafeDatabaseError);
  });
  it("REFUSES a database whose name does not end in _test", () => {
    for (const name of [
      DEV_DB,
      "postgres",
      `${TEST_DB}ing`,
      "test",
      TEST_DB.replace(/^./, (c) => c.toUpperCase()),
    ]) {
      expect(
        () => resolveTestDatabase({ TEST_DATABASE_URL: `postgresql://u:p@localhost:5432/${name}` }),
        name,
      ).toThrow(UnsafeTestDatabaseError);
    }
  });
  it("REFUSES to run on the development database even if it is named like a test one", () => {
    const same = `postgresql://u:p@localhost:5432/${TEST_DB}`;
    expect(() => resolveTestDatabase({ TEST_DATABASE_URL: same, DATABASE_URL: same })).toThrow(
      /development database/,
    );
    expect(() => resolveTestDatabase({ TEST_DATABASE_URL: same, DIRECT_URL: same })).toThrow(
      /development database/,
    );
  });
  it("sees through host aliases: localhost, 127.0.0.1 and ::1 are the same server", () => {
    const devUrl = `postgresql://u:p@localhost:5432/${TEST_DB}`;
    for (const alias of ["127.0.0.1", "[::1]", "127.0.0.2", "db.localhost"]) {
      expect(
        () =>
          resolveTestDatabase({
            TEST_DATABASE_URL: `postgresql://u:p@${alias}:5432/${TEST_DB}`,
            DATABASE_URL: devUrl,
          }),
        alias,
      ).toThrow(/development database/);
    }
  });
  it("allows the same name on a different local server (port)", () => {
    expect(() =>
      resolveTestDatabase({
        TEST_DATABASE_URL: `postgresql://u:p@localhost:55432/${TEST_DB}`,
        DATABASE_URL: `postgresql://u:p@localhost:5432/${TEST_DB}`,
      }),
    ).not.toThrow();
  });
  it("rejects unparseable URLs", () => {
    expect(() => resolveTestDatabase({ TEST_DATABASE_URL: "nonsense" })).toThrow(
      UnsafeTestDatabaseError,
    );
  });
});
