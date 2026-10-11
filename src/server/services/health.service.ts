import { pingDatabase } from "@/server/repositories/health.repository";

export type ReadinessReport = { db: "up" | "down"; latencyMs: number };

export async function checkReadiness(): Promise<ReadinessReport> {
  const start = performance.now();
  try {
    await pingDatabase();
    return { db: "up", latencyMs: Math.round(performance.now() - start) };
  } catch {
    return { db: "down", latencyMs: Math.round(performance.now() - start) };
  }
}
