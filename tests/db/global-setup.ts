import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { resolveTestDatabase } from "../../scripts/lib/test-database";

const MIGRATIONS = resolve(process.cwd(), "prisma/migrations");

/**
 * Runs once before the DB tests. Picks the test database through resolveTestDatabase (local host only, name ends in
 * `_test`, never the dev database), creates it if missing, then RESETS it and applies every migration in order.
 * Applying the migration SQL directly (instead of `prisma migrate deploy`) needs no Prisma engine and doubles as a
 * check that the hand-written SQL is valid PostgreSQL. It is NOT a drift check: use `prisma migrate diff` for that.
 */
export default async function setup(): Promise<void> {
  loadEnv({ quiet: true }); // .env supplies DATABASE_URL / TEST_DATABASE_URL locally; CI sets them directly
  const target = resolveTestDatabase(process.env);

  const admin = new pg.Client({ connectionString: target.adminUrl });
  try {
    await admin.connect();
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      target.database,
    ]);
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${target.database}"`);
  } catch (err) {
    throw new Error(
      `Could not prepare the test database "${target.database}": ${err instanceof Error ? err.message : String(err)}\n` +
        `Is your local PostgreSQL running, and do the credentials in .env allow CREATE DATABASE?\n` +
        `You can create it yourself:  createdb ${target.database}   (or: CREATE DATABASE ${target.database}; in psql)`,
    );
  } finally {
    await admin.end().catch(() => undefined);
  }

  const client = new pg.Client({ connectionString: target.url });
  await client.connect();
  try {
    const current = (await client.query("SELECT current_database() AS db")).rows[0]?.db as string;
    if (current !== target.database || !current.endsWith("_test")) {
      throw new Error(
        `Safety stop: connected to "${current}", expected the test database "${target.database}".`,
      );
    }
    await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    const dirs = readdirSync(MIGRATIONS, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const dir of dirs) {
      try {
        await client.query(readFileSync(join(MIGRATIONS, dir, "migration.sql"), "utf8"));
      } catch (err) {
        throw new Error(
          `Migration ${dir} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } finally {
    await client.end();
  }
  process.env["TEST_DATABASE_URL_RESOLVED"] = target.url;
}
