import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  // Pooled URL at runtime; the adapter owns the pg pool. Keep the pool small on serverless.
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    // Fail fast on an unreachable host instead of hanging a request (status and settings reads degrade gracefully).
    connectionTimeoutMillis: 5_000,
  });
  return new PrismaClient({ adapter });
}

/**
 * Lazy singleton: created on first use, never at import time, so builds and tests work without a database.
 * Survives HMR in dev. Only repositories and server-internal code may call this.
 */
export function getDb(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing) return existing;
  const client = createClient();
  globalForPrisma.prisma = client;
  return client;
}
