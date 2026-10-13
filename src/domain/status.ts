/**
 * Public system status. Deliberately COARSE: three states and a fixed component list. No versions, hostnames,
 * latencies or error text ever leave the server (the /status page and footer dot only show these values).
 * Components are added as the platform grows (email in M5a, payments in M7).
 */
export const COMPONENT_STATES = ["operational", "degraded", "down"] as const;
export type ComponentState = (typeof COMPONENT_STATES)[number];

export const STATUS_COMPONENTS = ["website", "api", "database"] as const;
export type StatusComponent = (typeof STATUS_COMPONENTS)[number];

export type SystemStatus = {
  overall: ComponentState;
  components: Record<StatusComponent, ComponentState>;
  /** ISO timestamp of the underlying check (the response may be a few seconds older due to caching). */
  checkedAt: string;
};

const RANK: Record<ComponentState, number> = { operational: 0, degraded: 1, down: 2 };

export const worstState = (states: readonly ComponentState[]): ComponentState =>
  states.reduce<ComponentState>((worst, s) => (RANK[s] > RANK[worst] ? s : worst), "operational");

/** Overall = the worst component. */
export const deriveOverall = (
  components: Record<StatusComponent, ComponentState>,
): ComponentState => worstState(Object.values(components));

/** A slow-but-answering dependency is "degraded"; no answer is "down". */
export const SLOW_PROBE_MS = 1500;

export function stateFromProbe(probe: { up: boolean; latencyMs: number }): ComponentState {
  if (!probe.up) return "down";
  return probe.latencyMs > SLOW_PROBE_MS ? "degraded" : "operational";
}

/** Runtime guard for data read from the network (the footer dot parses /api/status). */
export function parseSystemStatus(value: unknown): SystemStatus | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const state = (x: unknown): x is ComponentState => COMPONENT_STATES.some((s) => s === x);
  const comps = v["components"];
  if (!state(v["overall"]) || typeof comps !== "object" || comps === null) return null;
  const c = comps as Record<string, unknown>;
  if (!STATUS_COMPONENTS.every((k) => state(c[k]))) return null;
  return {
    overall: v["overall"],
    components: Object.fromEntries(
      STATUS_COMPONENTS.map((k) => [k, c[k]]),
    ) as SystemStatus["components"],
    checkedAt: typeof v["checkedAt"] === "string" ? v["checkedAt"] : "",
  };
}
