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
import { parseArguments, postJson, readArray, readNumber, readRecord, readString } from "./http.ts";

/**
 * Adapter for any OpenAI-compatible `/chat/completions` endpoint: OpenRouter,
 * OpenAI itself, Together, vLLM, Ollama, LM Studio. One adapter covers all of
 * them because the only differences are the base URL, the auth header and the
 * model id — all configuration, not code.
 */

export interface OpenAiCompatibleOptions {
  readonly id: string;
  readonly apiKey: string;
  readonly model: string;
  /** Defaults to OpenRouter. */
  readonly baseUrl?: string;
  readonly capabilities?: Partial<ProviderCapabilities>;
  readonly cost?: ProviderCost;
  readonly timeoutMs?: number;
  readonly extraHeaders?: Record<string, string>;
}

export class OpenAiCompatibleProvider implements ChatProvider {
  readonly id: string;
  readonly model: string;
  readonly capabilities: ProviderCapabilities;
  readonly cost: ProviderCost;

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;

  constructor(options: OpenAiCompatibleOptions) {
    if (options.apiKey.length === 0) {
      throw new AgentError("invalid_input", `provider ${options.id} needs an API key`);
    }
    this.id = options.id;
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.extraHeaders = options.extraHeaders ?? {};
    this.capabilities = {
      tools: true,
      streaming: true,
      vision: false,
      maxContextTokens: 128_000,
      ...options.capabilities,
    };
    this.cost = options.cost ?? { inputPerMillion: 0, outputPerMillion: 0 };
  }

  async complete(ctx: RequestContext, request: ChatRequest): Promise<ChatResponse> {
    ctx.throwIfDone();
    const body: Record<string, unknown> = {
      model: request.model ?? this.model,
      messages: request.messages.map(toWireMessage),
    };
    if (request.maxOutputTokens !== undefined) body["max_tokens"] = request.maxOutputTokens;
    if (request.temperature !== undefined) body["temperature"] = request.temperature;
    if (request.tools !== undefined && request.tools.length > 0) {
      body["tools"] = request.tools.map((tool) => ({
        type: "function",
        function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      }));
      body["tool_choice"] = "auto";
    }

    const timeoutMs = Math.min(this.timeoutMs, Math.max(1_000, ctx.remainingMs()));
    const payload = await postJson({
      url: `${this.baseUrl}/chat/completions`,
      headers: { authorization: `Bearer ${this.apiKey}`, ...this.extraHeaders },
      body,
      signal: ctx.signal,
      timeoutMs,
    });

    return parseCompletion(payload, this.model);
  }
}

function toWireMessage(message: ChatMessage): Record<string, unknown> {
  if (message.role === "tool") {
    return { role: "tool", content: message.content, tool_call_id: message.toolCallId };
  }
  if (message.toolCalls !== undefined && message.toolCalls.length > 0) {
    return {
      role: message.role,
      content: message.content.length > 0 ? message.content : null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: JSON.stringify(call.arguments) },
      })),
    };
  }
  return { role: message.role, content: message.content };
}

function parseCompletion(payload: unknown, fallbackModel: string): ChatResponse {
  const root = readRecord(payload);
  // Some gateways answer 200 with an error envelope instead of a status code.
  const errorEnvelope = readRecord(root["error"]);
  if (typeof errorEnvelope["message"] === "string") {
    throw new AgentError("provider_rejected", readString(errorEnvelope["message"], "provider error"));
  }

  const choice = readRecord(readArray(root["choices"])[0]);
  const message = readRecord(choice["message"]);
  const usage = readRecord(root["usage"]);
  const cacheDetails = readRecord(usage["prompt_tokens_details"]);

  const toolCalls: ToolCall[] = readArray(message["tool_calls"]).map((raw, index) => {
    const call = readRecord(raw);
    const fn = readRecord(call["function"]);
    return {
      id: readString(call["id"], `call_${index}`),
      name: readString(fn["name"]),
      arguments: parseArguments(fn["arguments"]),
    };
  });

  const finish = readString(choice["finish_reason"], "stop");
  return {
    text: readString(message["content"]),
    toolCalls,
    usage: {
      inputTokens: readNumber(usage["prompt_tokens"]),
      outputTokens: readNumber(usage["completion_tokens"]),
      cacheReadTokens: readNumber(cacheDetails["cached_tokens"]),
      cacheWriteTokens: 0,
    },
    model: readString(root["model"], fallbackModel),
    stopReason:
      toolCalls.length > 0 || finish === "tool_calls"
        ? "tool_use"
        : finish === "length"
          ? "length"
          : finish === "stop"
            ? "stop"
            : "other",
  };
}
