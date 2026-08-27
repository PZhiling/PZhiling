import type { RequestContext } from "../core/context.ts";

/** Wire-level message shape shared by every provider adapter. */
export interface ChatMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
  /** Set on assistant messages that requested tool calls. */
  readonly toolCalls?: readonly ToolCall[];
  /** Set on `tool` messages, matching the call being answered. */
  readonly toolCallId?: string;
  readonly name?: string;
}

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export interface ToolSchema {
  readonly name: string;
  readonly description: string;
  /** JSON Schema object describing the arguments. */
  readonly parameters: Record<string, unknown>;
}

export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
}

export const EMPTY_USAGE: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

export interface ChatRequest {
  readonly messages: readonly ChatMessage[];
  readonly tools?: readonly ToolSchema[];
  readonly maxOutputTokens?: number;
  readonly temperature?: number;
  /** Requested reasoning depth; adapters map this onto their own knob. */
  readonly effort?: "low" | "medium" | "high";
  /** Model override; otherwise the provider's configured default is used. */
  readonly model?: string;
}

export interface ChatResponse {
  readonly text: string;
  readonly toolCalls: readonly ToolCall[];
  readonly usage: Usage;
  readonly model: string;
  readonly stopReason: "stop" | "tool_use" | "length" | "other";
}

/**
 * Capabilities a route can require. Selection is capability-first: the router
 * picks the cheapest healthy provider that satisfies the request rather than
 * making the user pick one in a settings pane and live with it.
 */
export interface ProviderCapabilities {
  readonly tools: boolean;
  readonly streaming: boolean;
  readonly vision: boolean;
  readonly maxContextTokens: number;
}

export interface ProviderCost {
  /** USD per million tokens. */
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
}

export interface ChatProvider {
  readonly id: string;
  readonly model: string;
  readonly capabilities: ProviderCapabilities;
  readonly cost: ProviderCost;
  complete(ctx: RequestContext, request: ChatRequest): Promise<ChatResponse>;
}

/**
 * Rough token estimate used for budget guards and compaction decisions before
 * a request is sent. Deliberately cheap and provider-agnostic; real counts
 * from the response replace it in the ledger.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateRequestTokens(request: ChatRequest): number {
  let total = 0;
  for (const message of request.messages) {
    total += estimateTokens(message.content) + 4;
    for (const call of message.toolCalls ?? []) {
      total += estimateTokens(call.name) + estimateTokens(JSON.stringify(call.arguments));
    }
  }
  for (const tool of request.tools ?? []) {
    total += estimateTokens(tool.description) + estimateTokens(JSON.stringify(tool.parameters));
  }
  return total;
}
