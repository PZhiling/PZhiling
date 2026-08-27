import type { RequestContext } from "../../core/context.ts";
import { AgentError } from "../../core/errors.ts";
import type {
  ChatMessage,
  ChatProvider,
  ChatRequest,
  ChatResponse,
  ProviderCapabilities,
  ProviderCost,
  ToolCall,
} from "../provider.ts";
import { postJson, readArray, readNumber, readRecord, readString } from "./http.ts";

/**
 * Adapter for the Anthropic Messages API.
 *
 * Two shape differences from the OpenAI-compatible wire format are handled
 * here rather than leaking into the loop: the system prompt is a top-level
 * field, and tool results are `user` messages carrying `tool_result` blocks.
 */

/** Claude Opus 5, at its list price of $5 / $25 per million tokens. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5";
export const DEFAULT_ANTHROPIC_COST: ProviderCost = { inputPerMillion: 5, outputPerMillion: 25 };

export interface AnthropicProviderOptions {
  readonly id?: string;
  readonly apiKey: string;
  readonly model?: string;
  readonly baseUrl?: string;
  readonly capabilities?: Partial<ProviderCapabilities>;
  readonly cost?: ProviderCost;
  readonly timeoutMs?: number;
  readonly apiVersion?: string;
}

export class AnthropicProvider implements ChatProvider {
  readonly id: string;
  readonly model: string;
  readonly capabilities: ProviderCapabilities;
  readonly cost: ProviderCost;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly apiVersion: string;

  constructor(options: AnthropicProviderOptions) {
    if (options.apiKey.length === 0) {
      throw new AgentError("invalid_input", "anthropic provider needs an API key");
    }
    this.id = options.id ?? "anthropic";
    this.model = options.model ?? DEFAULT_ANTHROPIC_MODEL;
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.anthropic.com/v1").replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.apiVersion = options.apiVersion ?? "2023-06-01";
    this.capabilities = {
      tools: true,
      streaming: true,
      vision: true,
      maxContextTokens: 1_000_000,
      ...options.capabilities,
    };
    this.cost = options.cost ?? DEFAULT_ANTHROPIC_COST;
  }

  async complete(ctx: RequestContext, request: ChatRequest): Promise<ChatResponse> {
    ctx.throwIfDone();
    const { system, messages } = splitSystem(request.messages);

    const body: Record<string, unknown> = {
      model: request.model ?? this.model,
      max_tokens: request.maxOutputTokens ?? 16_000,
      messages,
    };
    if (system.length > 0) body["system"] = system;
    if (request.temperature !== undefined) body["temperature"] = request.temperature;
    if (request.tools !== undefined && request.tools.length > 0) {
      body["tools"] = request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));
    }
    if (request.effort !== undefined) {
      // Current models take adaptive thinking plus an effort level. The older
      // fixed `{type: "enabled", budget_tokens: N}` form is rejected with a
      // 400 on Opus 5 / Sonnet 5 and the 4.7+ family.
      body["thinking"] = { type: "adaptive" };
      body["output_config"] = { effort: request.effort };
    }

    const timeoutMs = Math.min(this.timeoutMs, Math.max(1_000, ctx.remainingMs()));
    const payload = await postJson({
      url: `${this.baseUrl}/messages`,
      headers: { "x-api-key": this.apiKey, "anthropic-version": this.apiVersion },
      body,
      signal: ctx.signal,
      timeoutMs,
    });

    return parseMessage(payload, this.model);
  }
}

function splitSystem(messages: readonly ChatMessage[]): {
  system: string;
  messages: Record<string, unknown>[];
} {
  const systemParts: string[] = [];
  const wire: Record<string, unknown>[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(message.content);
      continue;
    }
    if (message.role === "tool") {
      wire.push({
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: message.toolCallId ?? "", content: message.content },
        ],
      });
      continue;
    }
    if (message.role === "assistant" && message.toolCalls !== undefined && message.toolCalls.length > 0) {
      const blocks: Record<string, unknown>[] = [];
      if (message.content.length > 0) blocks.push({ type: "text", text: message.content });
      for (const call of message.toolCalls) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments });
      }
      wire.push({ role: "assistant", content: blocks });
      continue;
    }
    wire.push({ role: message.role, content: message.content });
  }

  return { system: systemParts.join("\n\n"), messages: mergeAdjacent(wire) };
}

/** The Messages API rejects two consecutive messages with the same role. */
function mergeAdjacent(messages: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const message of messages) {
    const previous = out[out.length - 1];
    if (previous !== undefined && previous["role"] === message["role"]) {
      out[out.length - 1] = {
        role: message["role"],
        content: [...asBlocks(previous["content"]), ...asBlocks(message["content"])],
      };
      continue;
    }
    out.push({ ...message });
  }
  return out;
}

function asBlocks(content: unknown): Record<string, unknown>[] {
  if (Array.isArray(content)) return content as Record<string, unknown>[];
  return [{ type: "text", text: readString(content) }];
}

function parseMessage(payload: unknown, fallbackModel: string): ChatResponse {
  const root = readRecord(payload);
  if (readString(root["type"]) === "error") {
    const error = readRecord(root["error"]);
    throw new AgentError("provider_rejected", readString(error["message"], "provider error"));
  }

  const texts: string[] = [];
  const toolCalls: ToolCall[] = [];
  for (const raw of readArray(root["content"])) {
    const block = readRecord(raw);
    const type = readString(block["type"]);
    if (type === "text") texts.push(readString(block["text"]));
    if (type === "tool_use") {
      toolCalls.push({
        id: readString(block["id"]),
        name: readString(block["name"]),
        arguments: readRecord(block["input"]),
      });
    }
  }

  const usage = readRecord(root["usage"]);
  const stop = readString(root["stop_reason"], "end_turn");
  return {
    text: texts.join("\n"),
    toolCalls,
    usage: {
      inputTokens: readNumber(usage["input_tokens"]),
      outputTokens: readNumber(usage["output_tokens"]),
      cacheReadTokens: readNumber(usage["cache_read_input_tokens"]),
      cacheWriteTokens: readNumber(usage["cache_creation_input_tokens"]),
    },
    model: readString(root["model"], fallbackModel),
    stopReason:
      stop === "tool_use"
        ? "tool_use"
        : stop === "max_tokens"
          ? "length"
          : stop === "end_turn" || stop === "stop_sequence"
            ? "stop"
            : "other",
  };
}
