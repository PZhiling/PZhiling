/**
 * One structured event shape for the whole runtime.
 *
 * Every event carries the request lineage it happened under, so a single
 * conversation turn can be reassembled from an unordered log without
 * correlating on timestamps.
 */

export const EVENT_LEVELS = ["debug", "info", "warn", "error"] as const;
export type EventLevel = (typeof EVENT_LEVELS)[number];

export interface Lineage {
  /** Stable for the whole conversation. */
  readonly traceId: string;
  /** One turn / one operation. */
  readonly spanId: string;
  readonly parentSpanId: string | undefined;
}

export interface TelemetryEvent {
  readonly at: number;
  readonly level: EventLevel;
  /** Dotted name, e.g. `router.attempt` or `tool.denied`. */
  readonly name: string;
  readonly lineage: Lineage;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface MetricSample {
  readonly at: number;
  readonly name: string;
  readonly kind: "counter" | "histogram";
  readonly value: number;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}
