import type { ChatMessage, ToolCall } from "../router/provider.ts";
import { estimateTokens } from "../router/provider.ts";

/**
 * The message list for one session, kept in provider-neutral form.
 *
 * Appending a tool result checks that the call it answers was actually
 * requested. A transcript that carries a result for a call the assistant never
 * made is rejected by providers with an opaque 400, and the cause is usually a
 * bug several layers up; catching it here names it immediately.
 */
export class Transcript {
  private readonly messages: ChatMessage[] = [];
  private readonly pendingCalls = new Set<string>();

  constructor(systemPrompt?: string) {
    if (systemPrompt !== undefined && systemPrompt.length > 0) {
      this.messages.push({ role: "system", content: systemPrompt });
    }
  }

  addUser(content: string): void {
    this.messages.push({ role: "user", content });
  }

  addSystem(content: string): void {
    this.messages.push({ role: "system", content });
  }

  addAssistant(content: string, toolCalls: readonly ToolCall[] = []): void {
    this.messages.push({ role: "assistant", content, toolCalls });
    for (const call of toolCalls) this.pendingCalls.add(call.id);
  }

  addToolResult(call: ToolCall, output: string): void {
    if (!this.pendingCalls.delete(call.id)) {
      throw new Error(`tool result for an unrequested call: ${call.id}`);
    }
    this.messages.push({ role: "tool", content: output, toolCallId: call.id, name: call.name });
  }

  /** Calls the assistant requested that have not been answered yet. */
  unansweredCalls(): number {
    return this.pendingCalls.size;
  }

  all(): readonly ChatMessage[] {
    return this.messages;
  }

  length(): number {
    return this.messages.length;
  }

  estimatedTokens(): number {
    return this.messages.reduce((total, message) => total + estimateTokens(message.content) + 4, 0);
  }

  /** Serializable form, for storing a resumable session. */
  toJSON(): ChatMessage[] {
    return [...this.messages];
  }

  static fromJSON(messages: readonly ChatMessage[]): Transcript {
    const transcript = new Transcript();
    for (const message of messages) {
      transcript.messages.push(message);
      if (message.role === "assistant") {
        for (const call of message.toolCalls ?? []) transcript.pendingCalls.add(call.id);
      }
      if (message.role === "tool" && message.toolCallId !== undefined) {
        transcript.pendingCalls.delete(message.toolCallId);
      }
    }
    return transcript;
  }
}
