import type { RequestContext } from "../core/context.ts";
import { AgentError, isRetryable, toAgentError } from "../core/errors.ts";
import { estimateRequestTokens, type ChatMessage, type ChatRequest } from "../router/provider.ts";
import type { RouteRequirements, RouteResult } from "../router/router.ts";

/**
 * Inference middleware.
 *
 * Same decorator shape as the design this is based on — each middleware wraps
 * the next and may alter the request on the way in or the result on the way
 * out. What is added is that middleware sits *around the router*, not around a
 * single provider, so retry and compaction compose with failover instead of
 * fighting it.
 */

export type InferenceCall = (
  ctx: RequestContext,
  request: ChatRequest,
  requirements: RouteRequirements,
) => Promise<RouteResult>;

export type InferenceMiddleware = (next: InferenceCall) => InferenceCall;

export function chain(base: InferenceCall, ...middleware: readonly InferenceMiddleware[]): InferenceCall {
  // Applied right-to-left so the first entry is the outermost wrapper and
  // therefore the first to see a request and the last to see a result.
  return middleware.reduceRight<InferenceCall>((next, wrap) => wrap(next), base);
}

export interface RetryOptions {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  /** Deterministic jitter source, for tests. */
  readonly random?: () => number;
}

/**
 * Retries only errors classified retryable at the throw site, with full jitter
 * and a `retry-after` override. A retry that would overrun the context
 * deadline is not attempted — it would fail anyway and burn the budget.
 */
export function withRetry(options: RetryOptions = {}): InferenceMiddleware {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 20_000;
  const random = options.random ?? Math.random;

  return (next) => async (ctx, request, requirements) => {
    let lastError: AgentError | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await next(ctx, request, requirements);
      } catch (error) {
        const agentError = toAgentError(error, "inference failed");
        lastError = agentError;
        if (!isRetryable(agentError) || attempt === maxAttempts) throw agentError;

        const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
        const delay = agentError.retryAfterMs ?? Math.floor(backoff * random());
        if (delay >= ctx.remainingMs()) {
          throw new AgentError("timeout", "not enough time left to retry", { cause: agentError });
        }
        ctx.emit("info", "inference.retry", {
          attempt,
          delayMs: delay,
          kind: agentError.kind,
        });
        ctx.count("inference.retry", 1, { kind: agentError.kind });
        await ctx.clock.sleep(delay, ctx.signal);
      }
    }
    throw lastError ?? new AgentError("internal", "retry loop ended without a result");
  };
}

export interface BudgetOptions {
  /** Reject a request estimated above this many input tokens. */
  readonly maxInputTokens?: number;
  /** Cap on output tokens applied to every request. */
  readonly maxOutputTokens?: number;
}

/** A guard against sending a request that is already known to be too large. */
export function withTokenBudget(options: BudgetOptions = {}): InferenceMiddleware {
  return (next) => async (ctx, request, requirements) => {
    const estimated = estimateRequestTokens(request);
    ctx.observe("inference.estimated_input_tokens", estimated, {});
    if (options.maxInputTokens !== undefined && estimated > options.maxInputTokens) {
      throw new AgentError("budget_exceeded", "request exceeds the configured input token budget", {
        details: { estimated, limit: options.maxInputTokens },
      });
    }
    const capped: ChatRequest =
      options.maxOutputTokens === undefined
        ? request
        : {
            ...request,
            maxOutputTokens: Math.min(request.maxOutputTokens ?? options.maxOutputTokens, options.maxOutputTokens),
          };
    return next(ctx, capped, requirements);
  };
}

export interface CompactionOptions {
  /** Compact once the estimate crosses this many tokens. */
  readonly triggerTokens: number;
  /** Always keep this many of the most recent messages verbatim. */
  readonly keepRecent?: number;
  /** Produces the replacement summary for the dropped middle. */
  readonly summarize?: (dropped: readonly ChatMessage[]) => string;
}

/**
 * Drops the middle of an over-long transcript, keeping the system prompt and
 * the most recent exchanges, and leaves a summary in place of what went.
 *
 * A tool result is never separated from the assistant message that requested
 * it — an orphaned `tool` message is rejected by every provider, which is the
 * failure mode a naive "keep the last N" window produces.
 */
export function withCompaction(options: CompactionOptions): InferenceMiddleware {
  const keepRecent = options.keepRecent ?? 8;
  const summarize = options.summarize ?? defaultSummary;

  return (next) => async (ctx, request, requirements) => {
    if (estimateRequestTokens(request) <= options.triggerTokens) {
      return next(ctx, request, requirements);
    }

    const messages = request.messages;
    const systemCount = messages.findIndex((message) => message.role !== "system");
    const head = systemCount <= 0 ? [] : messages.slice(0, systemCount);
    const body = messages.slice(head.length);
    if (body.length <= keepRecent) return next(ctx, request, requirements);

    let cut = body.length - keepRecent;
    // Walk the cut forward past any tool message that would be orphaned.
    while (cut < body.length && body[cut]?.role === "tool") cut += 1;

    const dropped = body.slice(0, cut);
    if (dropped.length === 0) return next(ctx, request, requirements);

    const compacted: ChatMessage[] = [
      ...head,
      { role: "system", content: summarize(dropped) },
      ...body.slice(cut),
    ];
    ctx.emit("info", "inference.compacted", {
      droppedMessages: dropped.length,
      keptMessages: compacted.length,
    });
    ctx.count("inference.compaction", 1, {});

    return next(ctx, { ...request, messages: compacted }, requirements);
  };
}

function defaultSummary(dropped: readonly ChatMessage[]): string {
  const lines = dropped.map((message) => {
    const label = message.role === "tool" ? `tool:${message.name ?? "result"}` : message.role;
    const text = message.content.replace(/\s+/g, " ").trim();
    return `- ${label}: ${text.length > 160 ? `${text.slice(0, 160)}...` : text}`;
  });
  return [
    "[Earlier turns were compacted to fit the context window.]",
    ...lines.slice(-40),
  ].join("\n");
}

/** Records one event per call with the route taken. */
export function withTracing(): InferenceMiddleware {
  return (next) => async (ctx, request, requirements) => {
    const startedAt = ctx.clock.now();
    try {
      const result = await next(ctx, request, requirements);
      ctx.emit("debug", "inference.ok", {
        provider: result.providerId,
        attempts: result.attempts.length,
        durationMs: ctx.clock.now() - startedAt,
        costUsd: Number(result.estimatedCostUsd.toFixed(6)),
      });
      return result;
    } catch (error) {
      const agentError = toAgentError(error);
      ctx.emit("error", "inference.failed", {
        kind: agentError.kind,
        message: agentError.message,
        durationMs: ctx.clock.now() - startedAt,
      });
      throw agentError;
    }
  };
}
