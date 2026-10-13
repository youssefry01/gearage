import {
  deriveOverall,
  stateFromProbe,
  type ComponentState,
  type SystemStatus,
} from "@/domain/status";
import { checkReadiness } from "@/server/services/health.service";

/** One real database probe at most every TTL per server instance, however much traffic hits /api/status. */
export const STATUS_TTL_MS = 30_000;
/** A hung database must not hang the endpoint: no answer within this window means "down". */
export const PROBE_TIMEOUT_MS = 2_500;

let cache: { value: SystemStatus; expiresAt: number } | null = null;
let inflight: Promise<SystemStatus> | null = null;

export function resetStatusCacheForTests(): void {
  cache = null;
  inflight = null;
}

async function probeDatabase(): Promise<ComponentState> {
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), PROBE_TIMEOUT_MS).unref?.(),
  );
  try {
    const result = await Promise.race([checkReadiness(), timeout]);
    if (result === "timeout") return "down";
    return stateFromProbe({ up: result.db === "up", latencyMs: result.latencyMs });
  } catch {
    return "down";
  }
}

async function compute(): Promise<SystemStatus> {
  const components = {
    // If this code is running, the website and API are serving requests.
    website: "operational",
    api: "operational",
    database: await probeDatabase(),
  } as const;
  const value: SystemStatus = {
    overall: deriveOverall(components),
    components,
    checkedAt: new Date().toISOString(),
  };
  cache = { value, expiresAt: Date.now() + STATUS_TTL_MS };
  return value;
}

/**
 * Coarse public status. Cached in memory with single-flight: concurrent callers share one probe, and nothing
 * touches the database more than once per TTL. Never throws and never includes error details.
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  inflight ??= compute().finally(() => {
    inflight = null;
  });
  return inflight;
}
