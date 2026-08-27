import type { RequestContext } from "../core/context.ts";
import { AgentError, toAgentError } from "../core/errors.ts";
import { BLOCKING_STEPS, type HookOutcome, type HookPayloads, type HookStep } from "./steps.ts";

export type HookHandler<S extends HookStep> = (
  ctx: RequestContext,
  payload: HookPayloads[S],
) => Promise<HookOutcome<S>> | HookOutcome<S>;

export interface HookRegistration<S extends HookStep> {
  readonly step: S;
  readonly name: string;
  readonly handler: HookHandler<S>;
  /** Lower runs first. Defaults to 100. */
  readonly priority?: number;
  /** Per-handler wall clock budget. Defaults to the bus setting. */
  readonly timeoutMs?: number;
}

export interface HookResult<S extends HookStep> {
  /** Payload after any `replace` outcomes, ready for the action to use. */
  readonly payload: HookPayloads[S];
  readonly denied: { readonly by: string; readonly reason: string } | undefined;
  /** Concatenated `context` outcomes, in handler order. */
  readonly addedContext: readonly string[];
}

export interface HookBusOptions {
  readonly defaultTimeoutMs?: number;
  /**
   * What to do when a handler throws or times out.
   *
   * `fail-closed` (the default for blocking steps) denies the action: a hook
   * that exists to veto something must not be defeated by crashing. `skip`
   * ignores the handler. This choice was implicit in the design this is based
   * on; making it explicit and defaulting blocking steps to fail-closed is the
   * main behavioural change.
   */
  readonly onHandlerError?: "fail-closed" | "skip";
}

/** Handlers are stored with their step type erased; `run` re-narrows them. */
type ErasedHandler = (
  ctx: RequestContext,
  payload: unknown,
) => Promise<HookOutcome<HookStep>> | HookOutcome<HookStep>;

interface StoredHook {
  readonly name: string;
  readonly handler: ErasedHandler;
  readonly priority: number;
  readonly timeoutMs: number | undefined;
}

export class HookBus {
  private readonly hooks = new Map<HookStep, StoredHook[]>();
  private readonly defaultTimeoutMs: number;
  private readonly onHandlerError: "fail-closed" | "skip";

  constructor(options: HookBusOptions = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 5_000;
    this.onHandlerError = options.onHandlerError ?? "fail-closed";
  }

  register<S extends HookStep>(registration: HookRegistration<S>): () => void {
    const list = this.hooks.get(registration.step) ?? [];
    const stored: StoredHook = {
      name: registration.name,
      handler: registration.handler as unknown as ErasedHandler,
      priority: registration.priority ?? 100,
      timeoutMs: registration.timeoutMs,
    };
    list.push(stored);
    list.sort((a, b) => a.priority - b.priority);
    this.hooks.set(registration.step, list);
    return () => {
      const current = this.hooks.get(registration.step);
      if (current === undefined) return;
      const index = current.indexOf(stored);
      if (index >= 0) current.splice(index, 1);
    };
  }

  count(step: HookStep): number {
    return this.hooks.get(step)?.length ?? 0;
  }

  /**
   * Run every handler for a step in priority order.
   *
   * The first denial stops the chain — later handlers cannot un-deny, which is
   * the same precedence rule the permission broker uses.
   */
  async run<S extends HookStep>(
    ctx: RequestContext,
    step: S,
    payload: HookPayloads[S],
  ): Promise<HookResult<S>> {
    const handlers = this.hooks.get(step) ?? [];
    let current = payload;
    const addedContext: string[] = [];

    for (const hook of handlers) {
      ctx.throwIfDone();
      const started = ctx.clock.now();
      let outcome: HookOutcome<S>;
      try {
        outcome = (await this.invoke(ctx, hook, current)) as unknown as HookOutcome<S>;
      } catch (error) {
        const agentError = toAgentError(error, "hook failed");
        if (agentError.kind === "cancelled") throw agentError;
        const failClosed = this.onHandlerError === "fail-closed" && BLOCKING_STEPS.has(step);
        ctx.emit("warn", "hook.error", {
          step,
          hook: hook.name,
          kind: agentError.kind,
          message: agentError.message,
          failClosed,
        });
        if (failClosed) {
          return {
            payload: current,
            denied: { by: hook.name, reason: `hook failed: ${agentError.message}` },
            addedContext,
          };
        }
        continue;
      } finally {
        ctx.observe("hook.duration_ms", ctx.clock.now() - started, { step, hook: hook.name });
      }

      if (outcome.kind === "deny") {
        ctx.emit("warn", "hook.deny", { step, hook: hook.name, reason: outcome.reason });
        return { payload: current, denied: { by: hook.name, reason: outcome.reason }, addedContext };
      }
      if (outcome.kind === "replace") {
        current = outcome.payload;
        ctx.emit("debug", "hook.replace", { step, hook: hook.name });
        continue;
      }
      if (outcome.kind === "context") {
        addedContext.push(outcome.text);
      }
    }

    return { payload: current, denied: undefined, addedContext };
  }

  /** Run a step and throw if it was denied. For call sites that cannot proceed. */
  async runOrThrow<S extends HookStep>(
    ctx: RequestContext,
    step: S,
    payload: HookPayloads[S],
  ): Promise<HookResult<S>> {
    const result = await this.run(ctx, step, payload);
    if (result.denied !== undefined) {
      throw new AgentError("permission_denied", `${step} blocked by ${result.denied.by}: ${result.denied.reason}`, {
        details: { step, hook: result.denied.by },
      });
    }
    return result;
  }

  private async invoke(
    ctx: RequestContext,
    hook: StoredHook,
    payload: unknown,
  ): Promise<HookOutcome<HookStep>> {
    const timeoutMs = hook.timeoutMs ?? this.defaultTimeoutMs;
    const { ctx: hookCtx, cancel } = ctx.child({ timeoutMs });
    // On the happy path `cancel()` aborts the sleep; swallow that rejection and
    // leave the timeout arm pending forever so it never surfaces as unhandled.
    const timedOut = ctx.clock.sleep(timeoutMs, hookCtx.signal).then(
      (): never => {
        throw new AgentError("timeout", `hook ${hook.name} exceeded ${timeoutMs}ms`);
      },
      () => new Promise<never>(() => {}),
    );
    try {
      return await Promise.race([Promise.resolve(hook.handler(hookCtx, payload)), timedOut]);
    } finally {
      cancel("hook finished");
    }
  }
}
