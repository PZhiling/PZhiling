import type { Clock } from "../core/clock.ts";
import type { RequestContext } from "../core/context.ts";
import { AgentError, isRetryable, toAgentError } from "../core/errors.ts";
import { CircuitBreaker, type BreakerOptions } from "./breaker.ts";
import {
  estimateRequestTokens,
  type ChatProvider,
  type ChatRequest,
  type ChatResponse,
} from "./provider.ts";
import { priceOf, UsageLedger, type UsageLedgerOptions } from "./usage.ts";

/**
 * Inference router.
 *
 * The design this is modelled on exposed a settings page where the user picked
 * one backend for new turns. That is kept as `pinnedProvider`, but it is no
 * longer the only mode: by default the router ranks the registered providers
 * for each request and fails over when one is unhealthy, so a provider outage
 * degrades the run instead of ending it.
 */

export type RoutingStrategy = "cheapest" | "priority" | "pinned";

export interface RouteRequirements {
  readonly tools?: boolean;
  readonly vision?: boolean;
  readonly minContextTokens?: number;
}

export interface RegisteredProvider {
  readonly provider: ChatProvider;
  /** Lower is preferred under the `priority` strategy. Defaults to 100. */
  readonly priority?: number;
  readonly breaker?: BreakerOptions;
}

export interface RouterOptions {
  readonly strategy?: RoutingStrategy;
  /** Provider id used by the `pinned` strategy, and preferred by the others. */
  readonly pinnedProvider?: string;
  readonly ledger?: UsageLedgerOptions;
  /** Maximum providers tried for a single request. Defaults to 3. */
  readonly maxAttempts?: number;
  readonly breaker?: BreakerOptions;
}

export interface RouteAttempt {
  readonly providerId: string;
  readonly ok: boolean;
  readonly errorKind?: string;
  readonly durationMs: number;
}

export interface RouteResult {
  readonly response: ChatResponse;
  readonly providerId: string;
  readonly attempts: readonly RouteAttempt[];
  readonly estimatedCostUsd: number;
}

interface Entry {
  readonly provider: ChatProvider;
  readonly priority: number;
  readonly breaker: CircuitBreaker;
}

export class InferenceRouter {
  private readonly entries = new Map<string, Entry>();
  readonly ledger: UsageLedger;
  private strategy: RoutingStrategy;
  private pinned: string | undefined;
  private readonly maxAttempts: number;
  private readonly breakerOptions: BreakerOptions | undefined;

  private readonly clock: Clock;

  constructor(clock: Clock, options: RouterOptions = {}) {
    this.clock = clock;
    this.strategy = options.strategy ?? "cheapest";
    this.pinned = options.pinnedProvider;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.breakerOptions = options.breaker;
    this.ledger = new UsageLedger(options.ledger);
  }

  register(registration: RegisteredProvider): this {
    const { provider } = registration;
    if (this.entries.has(provider.id)) {
      throw new AgentError("invalid_input", `provider already registered: ${provider.id}`);
    }
    this.entries.set(provider.id, {
      provider,
      priority: registration.priority ?? 100,
      breaker: new CircuitBreaker(this.clock, registration.breaker ?? this.breakerOptions),
    });
    return this;
  }

  setStrategy(strategy: RoutingStrategy, pinnedProvider?: string): void {
    this.strategy = strategy;
    if (pinnedProvider !== undefined) this.pinned = pinnedProvider;
  }

  providerIds(): string[] {
    return [...this.entries.keys()];
  }

  /**
   * Providers that satisfy the requirements, healthiest-and-preferred first.
   * A tripped breaker drops a provider to the back rather than removing it, so
   * a total outage still produces an attempt instead of an empty route.
   */
  candidates(requirements: RouteRequirements = {}): ChatProvider[] {
    const eligible = [...this.entries.values()].filter(({ provider }) => {
      const caps = provider.capabilities;
      if (requirements.tools === true && !caps.tools) return false;
      if (requirements.vision === true && !caps.vision) return false;
      if (requirements.minContextTokens !== undefined && caps.maxContextTokens < requirements.minContextTokens) {
        return false;
      }
      return true;
    });

    const rank = (entry: Entry): number => {
      const healthy = entry.breaker.currentState() === "open" ? 1 : 0;
      if (this.strategy === "pinned") {
        return healthy * 1e9 + (entry.provider.id === this.pinned ? 0 : 1e6) + entry.priority;
      }
      if (this.strategy === "priority") {
        return healthy * 1e9 + entry.priority;
      }
      // cheapest: order by blended price, with the pinned provider preferred
      // on a tie so an explicit choice still means something.
      const blended = entry.provider.cost.inputPerMillion + entry.provider.cost.outputPerMillion * 3;
      return healthy * 1e9 + blended * 1000 + (entry.provider.id === this.pinned ? 0 : 1);
    };

    return eligible.sort((a, b) => rank(a) - rank(b)).map((entry) => entry.provider);
  }

  async complete(
    ctx: RequestContext,
    request: ChatRequest,
    requirements: RouteRequirements = {},
  ): Promise<RouteResult> {
    this.ledger.assertWithinBudget();
    if (this.ledger.shouldWarn()) {
      ctx.emit("warn", "router.budget.warning", { spentUsd: Number(this.ledger.spentUsd().toFixed(4)) });
    }

    const estimated = estimateRequestTokens(request);
    const route = this.candidates({
      ...requirements,
      minContextTokens: requirements.minContextTokens ?? estimated,
      tools: requirements.tools ?? (request.tools !== undefined && request.tools.length > 0),
    });
    if (route.length === 0) {
      throw new AgentError("provider_unavailable", "no provider satisfies the request requirements", {
        details: { estimatedTokens: estimated, registered: this.entries.size },
      });
    }

    const attempts: RouteAttempt[] = [];
    let lastError: AgentError | undefined;

    for (const provider of route.slice(0, this.maxAttempts)) {
      ctx.throwIfDone();
      const entry = this.entries.get(provider.id);
      if (entry === undefined) continue;

      if (!entry.breaker.allow()) {
        attempts.push({ providerId: provider.id, ok: false, errorKind: "circuit_open", durationMs: 0 });
        ctx.emit("debug", "router.skip", {
          provider: provider.id,
          reason: "circuit open",
          retryAfterMs: entry.breaker.retryAfterMs(),
        });
        continue;
      }

      const startedAt = ctx.clock.now();
      try {
        const response = await provider.complete(ctx, request);
        const durationMs = ctx.clock.now() - startedAt;
        entry.breaker.onSuccess();
        this.ledger.record(provider.id, response.usage, provider.cost, ctx.clock.now());
        attempts.push({ providerId: provider.id, ok: true, durationMs });
        ctx.emit("info", "router.completed", {
          provider: provider.id,
          model: response.model,
          durationMs,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          attempt: attempts.length,
        });
        ctx.observe("router.duration_ms", durationMs, { provider: provider.id });
        return {
          response,
          providerId: provider.id,
          attempts,
          estimatedCostUsd: priceOf(response.usage, provider.cost),
        };
      } catch (error) {
        const agentError = toAgentError(error, "provider call failed");
        const durationMs = ctx.clock.now() - startedAt;
        attempts.push({ providerId: provider.id, ok: false, errorKind: agentError.kind, durationMs });
        this.ledger.recordFailure(provider.id, ctx.clock.now());

        // Cancellation and budget stops are the caller's decision, not a
        // provider fault: do not trip the breaker and do not fail over.
        if (agentError.kind === "cancelled" || agentError.kind === "budget_exceeded") throw agentError;

        entry.breaker.onFailure();
        lastError = agentError;
        ctx.emit("warn", "router.attempt.failed", {
          provider: provider.id,
          kind: agentError.kind,
          message: agentError.message,
          durationMs,
          willFailOver: isRetryable(agentError) || agentError.kind === "provider_rejected",
        });

        // A malformed request fails identically everywhere; do not burn the
        // other providers on it.
        if (agentError.kind === "invalid_input") throw agentError;
      }
    }

    throw new AgentError("provider_unavailable", "every routed provider failed", {
      cause: lastError,
      details: { attempts: attempts.length, lastKind: lastError?.kind ?? "none" },
    });
  }
}
