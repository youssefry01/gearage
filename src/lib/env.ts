import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  /** Pooled connection (pgbouncer/Supabase pooler) used at runtime. */
  DATABASE_URL: z.string().min(1),
  /** Direct connection used only by Prisma migrations. */
  DIRECT_URL: z.string().min(1).optional(),
  /** Shared secret for /api/cron/*; min 32 chars. */
  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 characters"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Where product images live (src/server/storage). Only "local" is implemented; production uses a hosted provider (M10a). */
  STORAGE_PROVIDER: z.enum(["local", "supabase", "cloudinary"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().min(1).default("public/uploads"),
  STORAGE_PUBLIC_BASE_URL: z.string().min(1).default("/uploads"),
  /** "1" exposes /{locale}/styleguide outside `next dev` (e2e on a production build). Keep "0" in production. */
  ENABLE_STYLEGUIDE: z.enum(["0", "1"]).default("0"),
});

export type Env = z.infer<typeof serverSchema>;

let cached: Env | undefined;

/** Parse and cache server env. Throws a readable error listing every invalid variable. */
export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env && cached) return cached;
  const result = serverSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    throw new Error(`Invalid environment variables:\n${lines.join("\n")}`);
  }
  if (source === process.env) cached = result.data;
  return result.data;
}

/** Called once at boot from instrumentation.ts. CI builds set SKIP_ENV_VALIDATION=1. */
export function validateEnvAtBoot(): void {
  if (process.env.SKIP_ENV_VALIDATION === "1") return;
  getEnv();
}
