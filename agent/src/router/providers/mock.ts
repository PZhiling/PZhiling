import type { RequestContext } from "../../core/context.ts";
import { AgentError } from "../../core/errors.ts";
import {
  estimateRequestTokens,
  estimateTokens,
  type ChatProvider,
  type ChatRequest,
  type ChatResponse,
  type ProviderCapabilities,
  type ProviderCost,
} from "../provider.ts";

/**
 * Scripted provider.
 *
 * Every test in this repository runs against it, and the CLI falls back to it
 * with no API key set, so the whole loop — hooks, permissions, tools, budget —
 * is exercisable offline.
 */

export type ScriptedTurn =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "tool";
      readonly calls: readonly { name: string; arguments: Record<string, unknown> }[];
      readonly text?: string;
    }
  | { readonly kind: "error"; readonly error: AgentError };

export interface MockProviderOptions {
  readonly id?: string;
  readonly model?: string;
  readonly script?: readonly ScriptedTurn[];
  /** Used once the script runs out. */
  readonly fallback?: ScriptedTurn;
  readonly capabilities?: Partial<ProviderCapabilities>;
  readonly cost?: ProviderCost;
  /** Simulated latency, advanced on the injected clock. */
  readonly latencyMs?: number;
}

export class MockProvider implements ChatProvider {
  readonly id: string;
  readonly model: string;
  readonly capabilities: ProviderCapabilities;
  readonly cost: ProviderCost;

  /** Requests seen so far, for assertions. */
  readonly seen: ChatRequest[] = [];

  private readonly script: ScriptedTurn[];
  private readonly fallback: ScriptedTurn;
  private readonly latencyMs: number;
  private callIndex = 0;

  constructor(options: MockProviderOptions = {}) {
    this.id = options.id ?? "mock";
    this.model = options.model ?? "mock-1";
    this.capabilities = {
      tools: true,
      streaming: false,
      vision: false,
      maxContextTokens: 200_000,
      ...options.capabilities,
    };
    this.cost = options.cost ?? { inputPerMillion: 0, outputPerMillion: 0 };
    this.script = [...(options.script ?? [])];
    this.fallback = options.fallback ?? { kind: "text", text: "done" };
    this.latencyMs = options.latencyMs ?? 0;
  }

  async complete(ctx: RequestContext, request: ChatRequest): Promise<ChatResponse> {
    ctx.throwIfDone();
    this.seen.push(request);
    if (this.latencyMs > 0) await ctx.clock.sleep(this.latencyMs, ctx.signal);
    ctx.throwIfDone();

    const turn = this.script.shift() ?? this.fallback;
    if (turn.kind === "error") throw turn.error;

    const inputTokens = estimateRequestTokens(request);
    if (turn.kind === "tool") {
      const calls = turn.calls.map((call, index) => ({
        id: `call_${this.callIndex++}_${index}`,
        name: call.name,
        arguments: call.arguments,
      }));
      return {
        text: turn.text ?? "",
        toolCalls: calls,
        usage: {
          inputTokens,
          outputTokens: estimateTokens(JSON.stringify(calls)),
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        model: this.model,
        stopReason: "tool_use",
      };
    }

    return {
      text: turn.text,
      toolCalls: [],
      usage: {
        inputTokens,
        outputTokens: estimateTokens(turn.text),
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      model: this.model,
      stopReason: "stop",
    };
  }
}
