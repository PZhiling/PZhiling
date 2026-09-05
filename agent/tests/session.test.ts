import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { ManualClock } from "../src/core/clock.ts";
import { createRootContext, type RequestContext } from "../src/core/context.ts";
import { AgentError } from "../src/core/errors.ts";
import { HookBus } from "../src/hooks/bus.ts";
import { chain, withRetry, type InferenceCall } from "../src/inference/middleware.ts";
import { AgentSession } from "../src/loop/session.ts";
import { Transcript } from "../src/loop/transcript.ts";
import { PermissionBroker } from "../src/permission/broker.ts";
import { MockProvider, type ScriptedTurn } from "../src/router/providers/mock.ts";
import { InferenceRouter } from "../src/router/router.ts";
import { createWorkspaceTools } from "../src/tools/builtin/workspace.ts";
import { ToolRegistry } from "../src/tools/registry.ts";
import { AgentStore } from "../src/kv/agent-store.ts";
import { MemoryBlobStore } from "../src/kv/blob-store.ts";
import type { ChatMessage } from "../src/router/provider.ts";
import { MemorySink } from "../src/telemetry/sink.ts";

async function workspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "zhiling-session-"));
  await writeFile(join(root, "answer.txt"), "the answer is 42\n");
  return root;
}

interface Harness {
  readonly ctx: RequestContext;
  readonly clock: ManualClock;
  readonly sink: MemorySink;
  readonly infer: InferenceCall;
  readonly provider: MockProvider;
  readonly tools: ToolRegistry;
}

async function harness(script: readonly ScriptedTurn[]): Promise<Harness & { root: string }> {
  const root = await workspace();
  const clock = new ManualClock();
  const sink = new MemorySink();
  const { ctx } = createRootContext({ clock, sink });
  const provider = new MockProvider({ id: "test", script });
  const router = new InferenceRouter(clock).register({ provider });
  const infer = chain((c, request, requirements) => router.complete(c, request, requirements), withRetry({ maxAttempts: 1 }));
  const tools = new ToolRegistry().registerAll(createWorkspaceTools({ root }));
  return { ctx, clock, sink, infer, provider, tools, root };
}

test("a plain answer completes in one step", async () => {
  const { ctx, infer, tools } = await harness([{ kind: "text", text: "hello there" }]);
  const session = new AgentSession({ infer, tools });

  const result = await session.run(ctx, "say hello");
  assert.equal(result.stopReason, "completed");
  assert.equal(result.text, "hello there");
  assert.equal(result.steps, 1);
  assert.equal(result.toolCalls.length, 0);
});

test("a tool call is executed and its result is fed back", async () => {
  const { ctx, infer, tools } = await harness([
    { kind: "tool", calls: [{ name: "read_file", arguments: { path: "answer.txt" } }] },
    { kind: "text", text: "the file says 42" },
  ]);
  const permissions = new PermissionBroker({ defaults: { "read-file": "always" } });
  const session = new AgentSession({ infer, tools, permissions });

  const result = await session.run(ctx, "what is in answer.txt?");
  assert.equal(result.stopReason, "completed");
  assert.equal(result.text, "the file says 42");
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0]?.ok, true);

  const toolMessage = result.transcript.all().find((message) => message.role === "tool");
  assert.match(toolMessage?.content ?? "", /the answer is 42/);
  assert.equal(result.transcript.unansweredCalls(), 0);
});

test("a denied tool call becomes a tool result the model can react to", async () => {
  const { ctx, infer, tools } = await harness([
    { kind: "tool", calls: [{ name: "write_file", arguments: { path: "out.txt", content: "x" } }] },
    { kind: "text", text: "understood, I will not write" },
  ]);
  const permissions = new PermissionBroker({ defaults: { "write-file": "never" } });
  const session = new AgentSession({ infer, tools, permissions });

  const result = await session.run(ctx, "write a file");
  assert.equal(result.stopReason, "completed");
  assert.equal(result.toolCalls[0]?.ok, false);
  const toolMessage = result.transcript.all().find((message) => message.role === "tool");
  assert.match(toolMessage?.content ?? "", /Permission denied/);
});

test("a hook can rewrite tool arguments before the tool runs", async () => {
  const { ctx, infer, tools, root } = await harness([
    { kind: "tool", calls: [{ name: "read_file", arguments: { path: "secrets.txt" } }] },
    { kind: "text", text: "done" },
  ]);
  await writeFile(join(root, "public.txt"), "safe content\n");

  const hooks = new HookBus();
  hooks.register({
    step: "beforeToolUse",
    name: "redirect",
    handler: (_ctx, payload) =>
      payload.input["path"] === "secrets.txt"
        ? { kind: "replace", payload: { ...payload, input: { path: "public.txt" } } }
        : { kind: "continue" },
  });

  const session = new AgentSession({
    infer,
    tools,
    hooks,
    permissions: new PermissionBroker({ defaults: { "read-file": "always" } }),
  });

  const result = await session.run(ctx, "read the secrets");
  const toolMessage = result.transcript.all().find((message) => message.role === "tool");
  assert.match(toolMessage?.content ?? "", /safe content/);
});

test("a hook denial on the prompt stops the run before any model call", async () => {
  const { ctx, infer, tools, provider } = await harness([{ kind: "text", text: "should not happen" }]);
  const hooks = new HookBus();
  hooks.register({
    step: "beforeSubmitPrompt",
    name: "policy",
    handler: () => ({ kind: "deny", reason: "prompt violates policy" }),
  });

  const session = new AgentSession({ infer, tools, hooks });
  const result = await session.run(ctx, "do something forbidden");

  assert.equal(result.stopReason, "denied");
  assert.equal(provider.seen.length, 0);
  assert.match(result.error?.message ?? "", /prompt violates policy/);
});

test("bad tool arguments are reported back instead of crashing the run", async () => {
  const { ctx, infer, tools } = await harness([
    { kind: "tool", calls: [{ name: "read_file", arguments: {} }] },
    { kind: "text", text: "I need a path" },
  ]);
  const session = new AgentSession({
    infer,
    tools,
    permissions: new PermissionBroker({ defaults: { "read-file": "always" } }),
  });

  const result = await session.run(ctx, "read something");
  assert.equal(result.stopReason, "completed");
  assert.match(result.toolCalls[0]?.detail ?? "", /Invalid arguments/);
});

test("an unknown tool is reported with the available names", async () => {
  const { ctx, infer, tools } = await harness([
    { kind: "tool", calls: [{ name: "teleport", arguments: {} }] },
    { kind: "text", text: "no such tool then" },
  ]);
  const session = new AgentSession({ infer, tools });

  const result = await session.run(ctx, "teleport");
  const toolMessage = result.transcript.all().find((message) => message.role === "tool");
  assert.match(toolMessage?.content ?? "", /Unknown tool/);
  assert.match(toolMessage?.content ?? "", /read_file/);
});

test("the step cap stops a tool loop that never converges", async () => {
  const root = await workspace();
  const clock = new ManualClock();
  const { ctx } = createRootContext({ clock });
  // The mock's fallback answers every step with the same tool call.
  const provider = new MockProvider({
    id: "looper",
    fallback: { kind: "tool", calls: [{ name: "list_directory", arguments: {} }] },
  });
  const router = new InferenceRouter(clock).register({ provider });
  const tools = new ToolRegistry().registerAll(createWorkspaceTools({ root }));

  const session = new AgentSession({
    infer: (c, request, requirements) => router.complete(c, request, requirements),
    tools,
    maxSteps: 3,
    permissions: new PermissionBroker({ defaults: { "list-directory": "always" } }),
  });

  const result = await session.run(ctx, "keep listing");
  assert.equal(result.stopReason, "max_steps");
  assert.equal(result.steps, 3);
  assert.equal(result.toolCalls.length, 3);
});

test("repeated empty replies stop the run as no_progress", async () => {
  const { ctx, infer, tools } = await harness([
    { kind: "text", text: "" },
    { kind: "text", text: "" },
  ]);
  const session = new AgentSession({ infer, tools, maxIdleSteps: 2 });
  const result = await session.run(ctx, "hello?");
  assert.equal(result.stopReason, "no_progress");
});

test("an inference failure ends the run with the typed error, not a throw", async () => {
  const { ctx, infer, tools } = await harness([
    { kind: "error", error: new AgentError("provider_rejected", "no credentials") },
  ]);
  const session = new AgentSession({ infer, tools });

  const result = await session.run(ctx, "anything");
  assert.equal(result.stopReason, "error");
  assert.equal(result.error?.kind, "provider_unavailable");
});

test("cancelling mid-run reports `cancelled`", async () => {
  const root = await workspace();
  const clock = new ManualClock();
  const { ctx, cancel } = createRootContext({ clock });
  const provider = new MockProvider({ id: "test", fallback: { kind: "text", text: "hi" } });
  const router = new InferenceRouter(clock).register({ provider });
  const tools = new ToolRegistry().registerAll(createWorkspaceTools({ root }));
  const session = new AgentSession({
    infer: (c, request, requirements) => router.complete(c, request, requirements),
    tools,
  });

  cancel("user pressed stop");
  const result = await session.run(ctx, "hello");
  assert.equal(result.stopReason, "cancelled");
});

test("the run emits telemetry carrying one trace id", async () => {
  const { ctx, infer, tools, sink } = await harness([
    { kind: "tool", calls: [{ name: "read_file", arguments: { path: "answer.txt" } }] },
    { kind: "text", text: "42" },
  ]);
  const session = new AgentSession({
    infer,
    tools,
    permissions: new PermissionBroker({ defaults: { "read-file": "always" } }),
  });

  await session.run(ctx, "read it");
  const traces = new Set(sink.events.map((event) => event.lineage.traceId));
  assert.equal(traces.size, 1);
  assert.equal(sink.named("tool.executed").length, 1);
  assert.equal(sink.named("router.completed").length, 2);
});

test("a transcript rejects a result for a call that was never made", () => {
  const transcript = new Transcript("system");
  assert.throws(() => transcript.addToolResult({ id: "ghost", name: "x", arguments: {} }, "output"));
});

test("a transcript round-trips through JSON with its pending calls intact", () => {
  const transcript = new Transcript("system");
  transcript.addUser("hi");
  transcript.addAssistant("", [{ id: "c1", name: "read_file", arguments: {} }]);
  assert.equal(transcript.unansweredCalls(), 1);

  const restored = Transcript.fromJSON(transcript.toJSON());
  assert.equal(restored.unansweredCalls(), 1);
  restored.addToolResult({ id: "c1", name: "read_file", arguments: {} }, "done");
  assert.equal(restored.unansweredCalls(), 0);
});

test("each step is checkpointed so a run can be resumed", async () => {
  const { ctx, infer, tools } = await harness([
    { kind: "tool", calls: [{ name: "read_file", arguments: { path: "answer.txt" } }] },
    { kind: "text", text: "42" },
  ]);
  const store = new AgentStore(new MemoryBlobStore(), "session");
  const session = new AgentSession({
    infer,
    tools,
    store,
    permissions: new PermissionBroker({ defaults: { "read-file": "always" } }),
  });

  await session.run(ctx, "read it");

  const saved = await store.get<{ step: number; messages: ChatMessage[] }>(ctx, `transcript:${session.id}`);
  assert.ok(saved);
  assert.equal(saved.step, 1);
  const resumed = Transcript.fromJSON(saved.messages);
  assert.equal(resumed.unansweredCalls(), 0);
});
