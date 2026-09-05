import { createRedactor, type PrivacyMode, type Redactor } from "../redaction/redact.ts";
import type { MetricSample, TelemetryEvent } from "./events.ts";

export interface TelemetrySink {
  event(event: TelemetryEvent): void;
  metric(sample: MetricSample): void;
}

export const nullSink: TelemetrySink = { event: () => {}, metric: () => {} };

/**
 * Bounded ring buffer. The studied runtime spilled overflow to disk; here the
 * buffer is explicitly lossy with a counter, because silently unbounded memory
 * is a worse failure than a known gap in a debug log.
 */
export class MemorySink implements TelemetrySink {
  readonly events: TelemetryEvent[] = [];
  readonly metrics: MetricSample[] = [];
  private droppedEvents = 0;
  private droppedMetrics = 0;

  private readonly capacity: number;

  constructor(capacity = 1000) {
    this.capacity = capacity;
  }

  event(event: TelemetryEvent): void {
    this.events.push(event);
    if (this.events.length > this.capacity) {
      this.events.shift();
      this.droppedEvents += 1;
    }
  }

  metric(sample: MetricSample): void {
    this.metrics.push(sample);
    if (this.metrics.length > this.capacity) {
      this.metrics.shift();
      this.droppedMetrics += 1;
    }
  }

  dropped(): { events: number; metrics: number } {
    return { events: this.droppedEvents, metrics: this.droppedMetrics };
  }

  named(name: string): TelemetryEvent[] {
    return this.events.filter((event) => event.name === name);
  }

  clear(): void {
    this.events.length = 0;
    this.metrics.length = 0;
  }
}

export class ConsoleSink implements TelemetrySink {
  private readonly minLevel: "debug" | "info" | "warn" | "error";

  constructor(minLevel: "debug" | "info" | "warn" | "error" = "info") {
    this.minLevel = minLevel;
  }

  private static readonly RANK = { debug: 0, info: 1, warn: 2, error: 3 } as const;

  event(event: TelemetryEvent): void {
    if (ConsoleSink.RANK[event.level] < ConsoleSink.RANK[this.minLevel]) return;
    const attrs = Object.keys(event.attributes).length > 0 ? ` ${JSON.stringify(event.attributes)}` : "";
    process.stderr.write(`[${event.level}] ${event.name} (${event.lineage.spanId})${attrs}\n`);
  }

  metric(): void {
    // Console output is for humans following a run; metrics go to a real sink.
  }
}

export function fanOut(...sinks: readonly TelemetrySink[]): TelemetrySink {
  return {
    event: (event) => {
      for (const sink of sinks) sink.event(event);
    },
    metric: (sample) => {
      for (const sink of sinks) sink.metric(sample);
    },
  };
}

/**
 * Wraps a sink so nothing reaches it un-redacted. Placing redaction here rather
 * than at each call site means adding a sink cannot leak by omission.
 */
export function redacting(inner: TelemetrySink, mode: PrivacyMode): TelemetrySink {
  const redactor: Redactor = createRedactor(mode);
  return {
    event: (event) =>
      inner.event({ ...event, attributes: redactor.value(event.attributes) }),
    metric: (sample) => inner.metric(sample),
  };
}
