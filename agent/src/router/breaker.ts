import type { Clock } from "../core/clock.ts";

/**
 * Per-provider circuit breaker.
 *
 * Without one, a provider that is down is re-tried on every turn and every
 * turn pays the full timeout. The breaker trips after a run of failures, stops
 * offering the provider for a cooldown, then lets exactly one probe through
 * before deciding whether it is back.
 */

export type BreakerState = "closed" | "open" | "half-open";

export interface BreakerOptions {
  /** Consecutive failures needed to open the circuit. */
  readonly failureThreshold?: number;
  /** How long the circuit stays open before a probe is allowed. */
  readonly cooldownMs?: number;
  /** Consecutive probe successes needed to close it again. */
  readonly successThreshold?: number;
}

export class CircuitBreaker {
  private state: BreakerState = "closed";
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private openedAt = 0;
  private probeInFlight = false;

  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly successThreshold: number;

  private readonly clock: Clock;

  constructor(clock: Clock, options: BreakerOptions = {}) {
    this.clock = clock;
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.successThreshold = options.successThreshold ?? 1;
  }

  /** Current state, after applying any elapsed cooldown. */
  currentState(): BreakerState {
    if (this.state === "open" && this.clock.now() - this.openedAt >= this.cooldownMs) {
      this.state = "half-open";
      this.probeInFlight = false;
    }
    return this.state;
  }

  /** Whether a call may be attempted right now. */
  allow(): boolean {
    const state = this.currentState();
    if (state === "closed") return true;
    if (state === "open") return false;
    // half-open: exactly one probe at a time.
    if (this.probeInFlight) return false;
    this.probeInFlight = true;
    return true;
  }

  onSuccess(): void {
    this.consecutiveFailures = 0;
    this.probeInFlight = false;
    if (this.state === "half-open") {
      this.consecutiveSuccesses += 1;
      if (this.consecutiveSuccesses >= this.successThreshold) {
        this.state = "closed";
        this.consecutiveSuccesses = 0;
      }
      return;
    }
    this.state = "closed";
  }

  onFailure(): void {
    this.consecutiveSuccesses = 0;
    this.probeInFlight = false;
    this.consecutiveFailures += 1;
    if (this.state === "half-open" || this.consecutiveFailures >= this.failureThreshold) {
      this.state = "open";
      this.openedAt = this.clock.now();
    }
  }

  /** Milliseconds until a probe is allowed; 0 when calls are allowed now. */
  retryAfterMs(): number {
    if (this.currentState() !== "open") return 0;
    return Math.max(0, this.cooldownMs - (this.clock.now() - this.openedAt));
  }
}
