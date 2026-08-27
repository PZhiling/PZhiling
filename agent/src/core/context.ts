import { randomUUID } from "node:crypto";

import type { Lineage, MetricSample, TelemetryEvent, EventLevel } from "../telemetry/events.ts";
import { nullSink, type TelemetrySink } from "../telemetry/sink.ts";
import { AgentError } from "./errors.ts";
import { systemClock, type Clock } from "./clock.ts";

/**
 * The single value threaded through every call in the runtime.
 *
 * It carries cancellation, a deadline, telemetry lineage and the clock. The
 * studied design passed an opaque `Context` for tracing only and handled
 * cancellation separately per subsystem; folding both into one object is what
 * lets `child()` narrow a deadline and a trace span in the same step.
 */
export interface RequestContext {
  readonly lineage: Lineage;
  readonly signal: AbortSignal;
  /** Absolute epoch-ms deadline, or `undefined` for no deadline. */
  readonly deadline: number | undefined;
  readonly clock: Clock;
  readonly sink: TelemetrySink;

  emit(level: EventLevel, name: string, attributes?: Record<string, unknown>): void;
  count(name: string, value?: number, attributes?: MetricSample["attributes"]): void;
  observe(name: string, value: number, attributes?: MetricSample["attributes"]): void;

  /** Milliseconds left before the deadline, `Infinity` when unbounded. */
  remainingMs(): number;
  /** Throws `AgentError("cancelled" | "timeout")` when the context is done. */
  throwIfDone(): void;

  /** A nested span, optionally with a tighter deadline and its own abort. */
  child(options?: ChildContextOptions): { ctx: RequestContext; cancel: (reason?: string) => void };
}

export interface ChildContextOptions {
  readonly timeoutMs?: number;
  readonly attributes?: Record<string, unknown>;
}

export interface RootContextOptions {
  readonly traceId?: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly clock?: Clock;
  readonly sink?: TelemetrySink;
}

function shortId(): string {
  return randomUUID().slice(0, 8);
}

class ContextImpl implements RequestContext {
  readonly lineage: Lineage;
  readonly signal: AbortSignal;
  readonly deadline: number | undefined;
  readonly clock: Clock;
  readonly sink: TelemetrySink;

  constructor(
    lineage: Lineage,
    signal: AbortSignal,
    deadline: number | undefined,
    clock: Clock,
    sink: TelemetrySink,
  ) {
    this.lineage = lineage;
    this.signal = signal;
    this.deadline = deadline;
    this.clock = clock;
    this.sink = sink;
  }

  emit(level: EventLevel, name: string, attributes: Record<string, unknown> = {}): void {
    const event: TelemetryEvent = {
      at: this.clock.now(),
      level,
      name,
      lineage: this.lineage,
      attributes,
    };
    this.sink.event(event);
  }

  count(name: string, value = 1, attributes: MetricSample["attributes"] = {}): void {
    this.sink.metric({ at: this.clock.now(), name, kind: "counter", value, attributes });
  }

  observe(name: string, value: number, attributes: MetricSample["attributes"] = {}): void {
    this.sink.metric({ at: this.clock.now(), name, kind: "histogram", value, attributes });
  }

  remainingMs(): number {
    if (this.deadline === undefined) return Number.POSITIVE_INFINITY;
    return Math.max(0, this.deadline - this.clock.now());
  }

  throwIfDone(): void {
    if (this.signal.aborted) {
      throw new AgentError("cancelled", "operation was cancelled", {
        details: { spanId: this.lineage.spanId },
      });
    }
    if (this.deadline !== undefined && this.clock.now() >= this.deadline) {
      throw new AgentError("timeout", "deadline exceeded", {
        details: { spanId: this.lineage.spanId },
      });
    }
  }

  child(options: ChildContextOptions = {}): { ctx: RequestContext; cancel: (reason?: string) => void } {
    const controller = new AbortController();
    const onParentAbort = (): void => controller.abort(this.signal.reason);
    if (this.signal.aborted) controller.abort(this.signal.reason);
    else this.signal.addEventListener("abort", onParentAbort, { once: true });

    // A child may tighten the deadline but never extend it past the parent's.
    const requested = options.timeoutMs === undefined ? undefined : this.clock.now() + options.timeoutMs;
    const deadline =
      requested === undefined
        ? this.deadline
        : this.deadline === undefined
          ? requested
          : Math.min(requested, this.deadline);

    const ctx = new ContextImpl(
      { traceId: this.lineage.traceId, spanId: shortId(), parentSpanId: this.lineage.spanId },
      controller.signal,
      deadline,
      this.clock,
      this.sink,
    );
    if (options.attributes !== undefined) ctx.emit("debug", "span.start", options.attributes);

    return {
      ctx,
      cancel: (reason = "cancelled by caller") => {
        this.signal.removeEventListener("abort", onParentAbort);
        controller.abort(reason);
      },
    };
  }
}

export function createRootContext(options: RootContextOptions = {}): {
  ctx: RequestContext;
  cancel: (reason?: string) => void;
} {
  const clock = options.clock ?? systemClock;
  const controller = new AbortController();
  if (options.signal !== undefined) {
    if (options.signal.aborted) controller.abort(options.signal.reason);
    else options.signal.addEventListener("abort", () => controller.abort(options.signal?.reason), { once: true });
  }
  const ctx = new ContextImpl(
    { traceId: options.traceId ?? randomUUID(), spanId: shortId(), parentSpanId: undefined },
    controller.signal,
    options.timeoutMs === undefined ? undefined : clock.now() + options.timeoutMs,
    clock,
    options.sink ?? nullSink,
  );
  return { ctx, cancel: (reason = "cancelled by caller") => controller.abort(reason) };
}
