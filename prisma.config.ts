import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations use the DIRECT (non-pooled) connection; the app runtime uses DATABASE_URL via the pg adapter.
const url =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/gearage";

export default defineConfig({
  schema: "prisma/schema",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed/index.ts" },
  datasource: { url },
});
