import { assertLocalDatabaseUrl, isLocalHost } from "../../prisma/guard";
import { brand } from "../../src/config/brand";

/** `<brand slug>_test`, e.g. the project's own test database. */
export const DEFAULT_TEST_DATABASE = `${brand.slug}_test`;
const TEST_NAME = /^[a-z][a-z0-9]*(_[a-z0-9]+)*_test$/;

export type TestDatabase = {
  /** Connection string of the test database. */
  url: string;
  /** Its name (always ends in `_test`). */
  database: string;
  /** Same server, maintenance database: used only to CREATE DATABASE when the test database is missing. */
  adminUrl: string;
};

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeTestDatabaseError";
  }
}

const databaseOf = (url: URL): string => decodeURIComponent(url.pathname.replace(/^\//, ""));
/** localhost, 127.0.0.1, ::1 and friends are ONE server for this comparison; only the port tells local servers apart. */
const serverOf = (url: URL): string =>
  `${isLocalHost(url.hostname) ? "local" : url.hostname.toLowerCase()}:${url.port || "5432"}`;

function parse(variable: string, value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new UnsafeTestDatabaseError(`${variable} is not a valid database URL.`);
  }
}

/**
 * Decides which database `npm run test:db` may touch, and refuses anything unsafe. Rules, in order:
 *  1. TEST_DATABASE_URL if set; otherwise the dev URL (DATABASE_URL/DIRECT_URL) with the database swapped for
 *     `<brand slug>_test`; otherwise a local default.
 *  2. The host must be local (the same guard that protects `prisma migrate dev`).
 *  3. The database name must end in `_test`.
 *  4. It must NOT be the development database (same server and same database name as DATABASE_URL/DIRECT_URL).
 */
export function resolveTestDatabase(
  env: Readonly<Record<string, string | undefined>>,
): TestDatabase {
  const dev = [env["DATABASE_URL"], env["DIRECT_URL"]].filter((v): v is string => !!v);
  const explicit = env["TEST_DATABASE_URL"];

  let target: URL;
  if (explicit) {
    target = parse("TEST_DATABASE_URL", explicit);
  } else {
    const base = dev[0] ?? "postgresql://postgres:postgres@localhost:5432/postgres";
    target = parse("DATABASE_URL", base);
    target.pathname = `/${DEFAULT_TEST_DATABASE}`;
    target.search = "";
  }
  const variable = explicit ? "TEST_DATABASE_URL" : "DATABASE_URL";

  assertLocalDatabaseUrl("test:db", variable, target.toString());

  const database = databaseOf(target);
  if (!TEST_NAME.test(database)) {
    throw new UnsafeTestDatabaseError(
      `Refusing to run DB tests: the database name "${database}" must end in "_test" (for example ${DEFAULT_TEST_DATABASE}).`,
    );
  }
  for (const value of dev) {
    const devUrl = parse("DATABASE_URL", value);
    if (serverOf(devUrl) === serverOf(target) && databaseOf(devUrl) === database) {
      throw new UnsafeTestDatabaseError(
        `Refusing to run DB tests: "${database}" is also your development database. Use a separate database ending in "_test".`,
      );
    }
  }

  const admin = new URL(target.toString());
  admin.pathname = "/postgres";
  admin.search = "";
  return { url: target.toString(), database, adminUrl: admin.toString() };
}
