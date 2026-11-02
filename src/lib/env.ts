import { z } from "zod";

/** An empty value in .env (`EMAIL_REPLY_TO=`) means "not set", never "set to the empty string". */
const blankIsUnset = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(blankIsUnset, schema.optional());
const withDefault = <T extends z.ZodType>(schema: T, value: z.output<T>) =>
  z.preprocess(blankIsUnset, schema.default(value as never));

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
  /** "false" hides the illustrative-catalog banner. Launch only, after prices and specs are verified (HANDOFF). */
  CATALOG_DEMO_NOTICE: z.string().optional(),
  /** "1" exposes /{locale}/styleguide outside `next dev` (e2e on a production build). Keep "0" in production. */
  ENABLE_STYLEGUIDE: z.enum(["0", "1"]).default("0"),

  // --- Authentication and security (M5a-1) ---
  /** Signs sessions (M5a-2) and derives the keys that hash identifiers for rate limits and view counts. `openssl rand -hex 32`. */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  /**
   * Pepper VERSION 1, used as the Argon2 secret. LOSING OR CHANGING IT INVALIDATES EVERY STORED PASSWORD (ADR 0003).
   * To rotate, add PASSWORD_PEPPER_V2 and set PASSWORD_PEPPER_CURRENT_VERSION=2; never edit or delete an old one.
   */
  PASSWORD_PEPPER: z.string().min(32, "PASSWORD_PEPPER must be at least 32 characters"),
  PASSWORD_PEPPER_CURRENT_VERSION: withDefault(z.coerce.number().int().min(1).max(9999), 1),
  /** "1" when the app runs behind exactly one proxy that sets the client IP (Vercel is detected by itself). */
  TRUST_PROXY_HEADERS: withDefault(z.enum(["0", "1"]), "0"),

  // --- Email (ADR 0022) ---
  /** `brevo` sends real email; `log` writes it to EMAIL_LOG_DIR. Default: brevo when BREVO_API_KEY is set, else log. */
  EMAIL_PROVIDER: optional(z.enum(["brevo", "log"])),
  BREVO_API_KEY: optional(z.string().min(10)),
  /** The verified sender address in Brevo. */
  EMAIL_FROM: optional(z.email()),
  /** Display name of the sender; defaults to the store name from the brand config. */
  EMAIL_FROM_NAME: optional(z.string().max(80)),
  EMAIL_REPLY_TO: optional(z.email()),
  /** Where the `log` provider writes emails. Gitignored. */
  EMAIL_LOG_DIR: withDefault(z.string().min(1), ".emails"),

  // --- Rate limiting (ADR 0021) ---
  UPSTASH_REDIS_REST_URL: optional(z.url()),
  UPSTASH_REDIS_REST_TOKEN: optional(z.string().min(10)),

  // --- Test safety (set by vitest and Playwright, never by hand) ---
  /** "1" forces the log email provider, disables Upstash and Brevo, whatever .env contains. */
  TEST_MODE: withDefault(z.enum(["0", "1"]), "0"),
  /** Test-only: multiplies every rate-limit maximum so parallel e2e workers sharing one IP are not throttled. */
  RATE_LIMIT_SCALE: withDefault(z.coerce.number().int().min(1).max(1000), 1),
  /** Set by Vercel ("production" | "preview" | "development"). */
  VERCEL_ENV: optional(z.string()),
});

export type Env = z.infer<typeof serverSchema>;

/** True under vitest (NODE_ENV=test) and whenever TEST_MODE=1 (Playwright). */
export function isTestMode(env: Pick<Env, "NODE_ENV" | "TEST_MODE">): boolean {
  return env.NODE_ENV === "test" || env.TEST_MODE === "1";
}

/** Which email provider runs. Test mode ALWAYS means `log`: a test run can never send real email. */
export function resolveEmailProvider(
  env: Pick<Env, "NODE_ENV" | "TEST_MODE" | "EMAIL_PROVIDER" | "BREVO_API_KEY">,
): "brevo" | "log" {
  if (isTestMode(env)) return "log";
  return env.EMAIL_PROVIDER ?? (env.BREVO_API_KEY ? "brevo" : "log");
}

/** Upstash is used only with both REST values present and never in test mode. */
export function upstashConfig(
  env: Pick<Env, "NODE_ENV" | "TEST_MODE" | "UPSTASH_REDIS_REST_URL" | "UPSTASH_REDIS_REST_TOKEN">,
): { url: string; token: string } | null {
  if (isTestMode(env)) return null;
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  return { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN };
}

const PEPPER_NAME = /^PASSWORD_PEPPER_V(\d{1,4})$/;
const PEPPER_MIN_LENGTH = 32;

/** Pepper versions from the environment: version 1 is PASSWORD_PEPPER, later ones PASSWORD_PEPPER_V2, _V3... */
export function loadPeppers(source: NodeJS.ProcessEnv): Map<number, string> {
  const peppers = new Map<number, string>();
  if (source.PASSWORD_PEPPER) peppers.set(1, source.PASSWORD_PEPPER);
  for (const [name, value] of Object.entries(source)) {
    const m = PEPPER_NAME.exec(name);
    if (m && value) peppers.set(Number(m[1]), value);
  }
  return peppers;
}

/** Cross-field rules that one field's schema cannot express. Returns readable problems (empty when fine). */
function crossChecks(source: NodeJS.ProcessEnv, env: Env): string[] {
  const problems: string[] = [];
  const hasUrl = Boolean(env.UPSTASH_REDIS_REST_URL);
  const hasToken = Boolean(env.UPSTASH_REDIS_REST_TOKEN);
  if (hasUrl !== hasToken) {
    problems.push(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together (or both left empty)",
    );
  }
  if (resolveEmailProvider(env) === "brevo") {
    if (!env.BREVO_API_KEY) problems.push("BREVO_API_KEY is required when EMAIL_PROVIDER=brevo");
    if (!env.EMAIL_FROM) problems.push("EMAIL_FROM is required when EMAIL_PROVIDER=brevo");
  }
  const peppers = loadPeppers(source);
  for (const [version, value] of peppers) {
    if (value.length < PEPPER_MIN_LENGTH) {
      problems.push(
        `${version === 1 ? "PASSWORD_PEPPER" : `PASSWORD_PEPPER_V${version}`} must be at least ${PEPPER_MIN_LENGTH} characters`,
      );
    }
  }
  if (!peppers.has(env.PASSWORD_PEPPER_CURRENT_VERSION)) {
    problems.push(
      `PASSWORD_PEPPER_CURRENT_VERSION=${env.PASSWORD_PEPPER_CURRENT_VERSION} has no matching pepper (set PASSWORD_PEPPER${env.PASSWORD_PEPPER_CURRENT_VERSION === 1 ? "" : `_V${env.PASSWORD_PEPPER_CURRENT_VERSION}`})`,
    );
  }
  if (env.VERCEL_ENV === "production") {
    if (env.TEST_MODE === "1") problems.push("TEST_MODE must not be 1 in production");
    if (env.RATE_LIMIT_SCALE !== 1) problems.push("RATE_LIMIT_SCALE must be 1 in production");
    if (resolveEmailProvider(env) === "log")
      problems.push("EMAIL_PROVIDER=log is not allowed in production (set BREVO_API_KEY)");
  }
  return problems;
}

let cached: Env | undefined;

/** Parse and cache server env. Throws a readable error listing every invalid variable. */
export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env && cached) return cached;
  const result = serverSchema.safeParse(source);
  const lines: string[] = result.success
    ? crossChecks(source, result.data).map((p) => `  - ${p}`)
    : result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
  if (!result.success || lines.length > 0) {
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
