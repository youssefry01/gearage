import "dotenv/config";
import { defineConfig } from "prisma/config";
import { assertSafeDatabaseCommand } from "./prisma/guard";

const LOCAL_DEFAULT = "postgresql://postgres:postgres@localhost:5432/gearage";

// Migrations use the DIRECT (non-pooled) connection; the app runtime uses DATABASE_URL via the pg adapter.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? LOCAL_DEFAULT;

// Runs on every Prisma CLI invocation, including `npx prisma migrate dev` typed by hand.
assertSafeDatabaseCommand(process.argv.slice(2), {
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
});

export default defineConfig({
  schema: "prisma/schema",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed/index.ts" },
  datasource: { url },
});
