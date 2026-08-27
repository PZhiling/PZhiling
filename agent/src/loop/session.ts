import { randomUUID } from "node:crypto";

import type { RequestContext } from "../core/context.ts";
import { AgentError, toAgentError } from "../core/errors.ts";
import { HookBus } from "../hooks/bus.ts";
import type { AgentStore } from "../kv/agent-store.ts";
import type { InferenceCall } from "../inference/middleware.ts";
import type { PermissionBroker } from "../permission/broker.ts";
import type { ChatRequest, Effort, ToolCall } from "../router/provider.ts";
import type { ToolRegistry } from "../tools/registry.ts";
import { Transcript } from "./transcript.ts";

/**
 * The turn loop.
 *
 * One pass is: hooks → model call → tool calls (each hook-gated, permission-
 * checked, validated, executed) → repeat until the model stops asking for
 * tools or a stop condition fires.
 *
 * Stop conditions are explicit and all of them are reported, because "the run
 * ended" without a reason is the single most expensive thing to debug in an
 * agent: `completed`, `max_steps`, `no_progress`, `denied`, `cancelled`,
 * `error`.
 */

export type StopReason =
  | "completed"
  | "max_steps"
  | "no_progress"
  | "denied"
  | "cancelled"
  | "error";

export interface SessionOptions {
  readonly infer: InferenceCall;
  readonly tools: ToolRegistry;
  readonly hooks?: HookBus;
  readonly permissions?: PermissionBroker;
  readonly store?: AgentStore;
  readonly systemPrompt?: string;
  /** Hard cap on model round-trips per run. Defaults to 12. */
  readonly maxSteps?: number;
  /**
   * Stop after this many consecutive steps that produced no tool call and no
   * text. Defaults to 2. Guards against a model that keeps answering emptily.
   */
  readonly maxIdleSteps?: number;
  readonly maxOutputTokens?: number;
  readonly temperature?: number;
  readonly effort?: Effort;
  /** Per-tool-call wall clock budget. Defaults to 120s. */
  readonly toolTimeoutMs?: number;
}

export interface ToolRecord {
  readonly step: number;
  readonly tool: string;
  readonly ok: boolean;
  readonly durationMs: number;
  readonly detail: string;
}

export interface RunResult {
  readonly text: string;
  readonly stopReason: StopReason;
  readonly steps: number;
  readonly toolCalls: readonly ToolRecord[];
  readonly estimatedCostUsd: number;
  readonly transcript: Transcript;
  readonly error?: AgentError;
}

export class AgentSession {
  readonly id: string;
  readonly transcript: Transcript;

  private readonly options: Required<
    Pick<SessionOptions, "maxSteps" | "maxIdleSteps" | "toolTimeoutMs">
  > &
    SessionOptions;
  private readonly hooks: HookBus;
  private turns = 0;

  constructor(options: SessionOptions) {
    this.id = randomUUID();
    this.transcript = new Transcript(options.systemPrompt);
    this.hooks = options.hooks ?? new HookBus();
    this.options = {
      ...options,
      maxSteps: options.maxSteps ?? 12,
      maxIdleSteps: options.maxIdleSteps ?? 2,
      toolTimeoutMs: options.toolTimeoutMs ?? 120_000,
    };
  }

  async start(ctx: RequestContext): Promise<void> {
    await this.hooks.run(ctx, "sessionStart", { sessionId: this.id });
  }

  async end(ctx: RequestContext): Promise<void> {
    await this.hooks.run(ctx, "sessionEnd", { sessionId: this.id, turns: this.turns });
    this.options.permissions?.endSession();
  }

  /** Run one user prompt to completion. */
  async run(ctx: RequestContext, prompt: string): Promise<RunResult> {
    this.turns += 1;
    const toolCalls: ToolRecord[] = [];
    let cost = 0;

    const submitted = await this.hooks.run(ctx, "beforeSubmitPrompt", { prompt });
    if (submitted.denied !== undefined) {
      return this.finish("denied", "", 0, toolCalls, cost, {
        error: new AgentError("permission_denied", `prompt blocked by ${submitted.denied.by}: ${submitted.denied.reason}`),
      });
    }
    this.transcript.addUser(submitted.payload.prompt);
    for (const note of submitted.addedContext) this.transcript.addSystem(note);

    let idleSteps = 0;
    let lastText = "";

    for (let step = 1; step <= this.options.maxSteps; step += 1) {
      try {
        ctx.throwIfDone();
      } catch (error) {
        return this.finish("cancelled", lastText, step - 1, toolCalls, cost, { error: toAgentError(error) });
      }

      const request: ChatRequest = {
        messages: this.transcript.all(),
        tools: this.options.tools.schemas(),
        maxOutputTokens: this.options.maxOutputTokens,
        temperature: this.options.temperature,
        effort: this.options.effort,
      };

      const before = await this.hooks.run(ctx, "beforeModelCall", {
        model: "routed",
        messageCount: this.transcript.length(),
        estimatedTokens: this.transcript.estimatedTokens(),
      });
      if (before.denied !== undefined) {
        return this.finish("denied", lastText, step - 1, toolCalls, cost, {
          error: new AgentError("permission_denied", `model call blocked by ${before.denied.by}: ${before.denied.reason}`),
        });
      }

      let routed;
      try {
        routed = await this.options.infer(ctx, request, { tools: true });
      } catch (error) {
        const agentError = toAgentError(error, "inference failed");
        const reason: StopReason = agentError.kind === "cancelled" ? "cancelled" : "error";
        return this.finish(reason, lastText, step - 1, toolCalls, cost, { error: agentError });
      }

      cost += routed.estimatedCostUsd;
      const response = routed.response;
      await this.hooks.run(ctx, "afterModelCall", {
        model: response.model,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      });

      this.transcript.addAssistant(response.text, response.toolCalls);
      if (response.text.length > 0) {
        lastText = response.text;
        await this.hooks.run(ctx, "afterAgentResponse", { text: response.text });
      }

      if (response.toolCalls.length === 0) {
        if (response.text.length === 0) {
          idleSteps += 1;
          if (idleSteps >= this.options.maxIdleSteps) {
            return this.finish("no_progress", lastText, step, toolCalls, cost, {});
          }
          // Nudge rather than spin silently.
          this.transcript.addSystem("The previous reply was empty. Answer the request or call a tool.");
          continue;
        }
        return this.finish("completed", lastText, step, toolCalls, cost, {});
      }

      idleSteps = 0;
      for (const call of response.toolCalls) {
        const record = await this.runToolCall(ctx, step, call);
        toolCalls.push(record);
      }
      await this.checkpoint(ctx, step);
    }

    return this.finish("max_steps", lastText, this.options.maxSteps, toolCalls, cost, {});
  }

  /**
   * Save the transcript after each step so a crashed or cancelled run can be
   * resumed from the last completed step rather than from the prompt. A
   * checkpoint failure is reported but never ends the run: losing a snapshot
   * is not worth losing the work it describes.
   */
  private async checkpoint(ctx: RequestContext, step: number): Promise<void> {
    if (this.options.store === undefined) return;
    try {
      await this.options.store.set(ctx, `transcript:${this.id}`, {
        turn: this.turns,
        step,
        messages: this.transcript.toJSON(),
      });
    } catch (error) {
      ctx.emit("warn", "session.checkpoint.failed", { message: toAgentError(error).message });
    }
  }

  /**
   * One tool call, gated in a fixed order: hook → validate → permission →
   * execute. Validation precedes the permission check on purpose — the broker
   * matches on the concrete command or path, and those only exist once the
   * arguments are known to be well formed.
   */
  private async runToolCall(ctx: RequestContext, step: number, call: ToolCall): Promise<ToolRecord> {
    const startedAt = ctx.clock.now();
    const fail = (detail: string): ToolRecord => {
      this.transcript.addToolResult(call, detail);
      return { step, tool: call.name, ok: false, durationMs: ctx.clock.now() - startedAt, detail };
    };

    const gate = await this.hooks.run(ctx, "beforeToolUse", { tool: call.name, input: call.arguments });
    if (gate.denied !== undefined) {
      await this.hooks.run(ctx, "toolUseFailed", {
        tool: call.name,
        errorKind: "permission_denied",
        message: gate.denied.reason,
      });
      return fail(`Blocked by ${gate.denied.by}: ${gate.denied.reason}`);
    }

    let tool;
    try {
      tool = this.options.tools.get(call.name);
    } catch (error) {
      return fail(`Unknown tool \`${call.name}\`. Available: ${this.options.tools.names().join(", ")}`);
    }

    let input;
    try {
      input = tool.validate(gate.payload.input);
    } catch (error) {
      const agentError = toAgentError(error, "invalid tool arguments");
      await this.hooks.run(ctx, "toolUseFailed", {
        tool: call.name,
        errorKind: agentError.kind,
        message: agentError.message,
      });
      return fail(`Invalid arguments: ${agentError.message}`);
    }

    if (this.options.permissions !== undefined) {
      try {
        await this.options.permissions.check(ctx, {
          action: tool.action,
          tool: tool.name,
          ...tool.describe(input),
        });
      } catch (error) {
        const agentError = toAgentError(error, "permission denied");
        await this.hooks.run(ctx, "toolUseFailed", {
          tool: call.name,
          errorKind: agentError.kind,
          message: agentError.message,
        });
        return fail(`Permission denied: ${agentError.message}`);
      }
    }

    const { ctx: toolCtx, cancel } = ctx.child({ timeoutMs: tool.timeoutMs ?? this.options.toolTimeoutMs });
    try {
      const result = await tool.execute(toolCtx, input);
      const durationMs = ctx.clock.now() - startedAt;
      this.transcript.addToolResult(call, result.output);
      await this.hooks.run(ctx, "afterToolUse", {
        tool: call.name,
        output: result.output,
        durationMs,
      });
      ctx.observe("tool.duration_ms", durationMs, { tool: call.name, ok: result.isError !== true });
      ctx.emit("info", "tool.executed", {
        tool: call.name,
        ok: result.isError !== true,
        durationMs,
        ...result.metadata,
      });
      return {
        step,
        tool: call.name,
        ok: result.isError !== true,
        durationMs,
        detail: result.output.slice(0, 200),
      };
    } catch (error) {
      const agentError = toAgentError(error, "tool execution failed");
      // Cancellation is the run ending, not a tool result the model should
      // see; let it propagate so the loop reports `cancelled`.
      if (agentError.kind === "cancelled" && ctx.signal.aborted) throw agentError;
      await this.hooks.run(ctx, "toolUseFailed", {
        tool: call.name,
        errorKind: agentError.kind,
        message: agentError.message,
      });
      ctx.emit("warn", "tool.failed", { tool: call.name, kind: agentError.kind, message: agentError.message });
      return fail(`Tool failed (${agentError.kind}): ${agentError.message}`);
    } finally {
      cancel("tool finished");
    }
  }

  private finish(
    stopReason: StopReason,
    text: string,
    steps: number,
    toolCalls: readonly ToolRecord[],
    estimatedCostUsd: number,
    extra: { error?: AgentError },
  ): RunResult {
    return {
      text,
      stopReason,
      steps,
      toolCalls,
      estimatedCostUsd,
      transcript: this.transcript,
      ...(extra.error === undefined ? {} : { error: extra.error }),
    };
  }
}
