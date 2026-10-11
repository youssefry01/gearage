/**
 * Safety guard: destructive or data-writing Prisma commands may only run against a LOCAL database.
 * Production only ever uses `prisma migrate deploy`. There is deliberately no override flag.
 * Loaded from prisma.config.ts (so it also protects direct `npx prisma ...` calls) and from the seed script.
 */

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);

/** Command words that are refused against non-local databases. `migrate deploy`, `status`, `diff`, `generate` stay allowed. */
const GUARDED: readonly (readonly string[])[] = [
  ["migrate", "dev"],
  ["migrate", "reset"],
  ["db", "push"],
  ["db", "seed"],
  ["db", "execute"],
  ["studio"],
];

export function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (LOCAL_HOSTNAMES.has(h) || h.endsWith(".localhost")) return true;
  return /^127(\.\d{1,3}){3}$/.test(h);
}

/** Returns the host of a Postgres URL, or null when it cannot be determined (treated as NOT local). */
export function hostOf(connectionString: string): string | null {
  try {
    const url = new URL(connectionString);
    // `?host=/var/run/postgresql` selects a unix socket, which is always on this machine.
    const socket = url.searchParams.get("host");
    if (socket?.startsWith("/")) return "localhost";
    return url.hostname || "localhost"; // empty host means the default local socket
  } catch {
    return null;
  }
}

export function isGuardedCommand(argv: readonly string[]): boolean {
  const words = argv.filter((a) => !a.startsWith("-"));
  return GUARDED.some((cmd) => {
    const at = words.indexOf(cmd[0] as string);
    return at !== -1 && cmd.every((w, i) => words[at + i] === w);
  });
}

export class UnsafeDatabaseError extends Error {
  constructor(command: string, host: string | null, variable: string) {
    super(
      [
        `Refusing to run "${command}": ${variable} points at a non-local database (host: ${host ?? "unparseable"}).`,
        "This command can modify or erase data and only runs against localhost / 127.0.0.1 / ::1.",
        "Production is migrated with `prisma migrate deploy` only. There is no override.",
      ].join("\n"),
    );
    this.name = "UnsafeDatabaseError";
  }
}

/** Throws UnsafeDatabaseError if `argv` is a guarded command and any configured database URL is not local. */
export function assertSafeDatabaseCommand(
  argv: readonly string[],
  urls: Readonly<Record<string, string | undefined>>,
): void {
  if (!isGuardedCommand(argv)) return;
  const command = argv.filter((a) => !a.startsWith("-")).join(" ");
  for (const [variable, value] of Object.entries(urls)) {
    if (!value) continue;
    const host = hostOf(value);
    if (host === null || !isLocalHost(host)) throw new UnsafeDatabaseError(command, host, variable);
  }
}

/** Seed entry points call this directly because `tsx prisma/seed/index.ts` bypasses the Prisma CLI. */
export function assertLocalDatabaseForSeed(
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  assertSafeDatabaseCommand(["db", "seed"], {
    DATABASE_URL: env.DATABASE_URL,
    DIRECT_URL: env.DIRECT_URL,
  });
}
