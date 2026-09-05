/**
 * Lifecycle hook points.
 *
 * The set mirrors the shape of the design this is modelled on, but each step
 * is *typed*: a handler for `beforeToolUse` receives a tool payload and may
 * only return a tool-shaped outcome. In the original, every hook shared one
 * loose payload bag and handlers guessed which fields were populated.
 */

export const HOOK_STEPS = [
  "sessionStart",
  "sessionEnd",
  "beforeSubmitPrompt",
  "beforeToolUse",
  "afterToolUse",
  "toolUseFailed",
  "beforeShellExecution",
  "afterShellExecution",
  "beforeReadFile",
  "afterFileEdit",
  "beforeModelCall",
  "afterModelCall",
  "beforeCompact",
  "afterAgentResponse",
  "subagentStart",
  "subagentStop",
  "stop",
] as const;

export type HookStep = (typeof HOOK_STEPS)[number];

/** Steps that gate an action and may therefore block it. */
export const BLOCKING_STEPS: ReadonlySet<HookStep> = new Set<HookStep>([
  "beforeSubmitPrompt",
  "beforeToolUse",
  "beforeShellExecution",
  "beforeReadFile",
  "beforeModelCall",
  "beforeCompact",
]);

export interface HookPayloads {
  sessionStart: { readonly sessionId: string };
  sessionEnd: { readonly sessionId: string; readonly turns: number };
  beforeSubmitPrompt: { readonly prompt: string };
  beforeToolUse: { readonly tool: string; readonly input: Record<string, unknown> };
  afterToolUse: { readonly tool: string; readonly output: string; readonly durationMs: number };
  toolUseFailed: { readonly tool: string; readonly errorKind: string; readonly message: string };
  beforeShellExecution: { readonly command: string; readonly cwd: string };
  afterShellExecution: { readonly command: string; readonly exitCode: number };
  beforeReadFile: { readonly path: string };
  afterFileEdit: { readonly path: string; readonly bytesWritten: number };
  beforeModelCall: { readonly model: string; readonly messageCount: number; readonly estimatedTokens: number };
  afterModelCall: { readonly model: string; readonly inputTokens: number; readonly outputTokens: number };
  beforeCompact: { readonly messageCount: number; readonly estimatedTokens: number };
  afterAgentResponse: { readonly text: string };
  subagentStart: { readonly name: string; readonly task: string };
  subagentStop: { readonly name: string; readonly ok: boolean };
  stop: { readonly reason: string };
}

/**
 * What a handler may return.
 *
 * `continue` is the default. `deny` stops the action with a reason the model
 * sees. `replace` rewrites the payload for the remaining handlers and for the
 * action itself; `context` appends guidance without changing the payload.
 */
export type HookOutcome<S extends HookStep> =
  | { readonly kind: "continue" }
  | { readonly kind: "deny"; readonly reason: string }
  | { readonly kind: "replace"; readonly payload: HookPayloads[S] }
  | { readonly kind: "context"; readonly text: string };

export const CONTINUE: HookOutcome<HookStep> = { kind: "continue" };
