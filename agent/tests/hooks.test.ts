import assert from "node:assert/strict";
import { test } from "node:test";

import { ManualClock } from "../src/core/clock.ts";
import { createRootContext } from "../src/core/context.ts";
import type { AgentError } from "../src/core/errors.ts";
import { HookBus } from "../src/hooks/bus.ts";

function setup() {
  const clock = new ManualClock();
  const { ctx } = createRootContext({ clock });
  return { ctx, clock };
}

test("handlers run in priority order", async () => {
  const bus = new HookBus();
  const order: string[] = [];
  bus.register({ step: "beforeToolUse", name: "late", priority: 200, handler: () => { order.push("late"); return { kind: "continue" }; } });
  bus.register({ step: "beforeToolUse", name: "early", priority: 10, handler: () => { order.push("early"); return { kind: "continue" }; } });

  const { ctx } = setup();
  await bus.run(ctx, "beforeToolUse", { tool: "read_file", input: {} });
  assert.deepEqual(order, ["early", "late"]);
});

test("a `replace` outcome is visible to later handlers and to the caller", async () => {
  const bus = new HookBus();
  bus.register({
    step: "beforeToolUse",
    name: "rewrite",
    priority: 1,
    handler: (_ctx, payload) => ({ kind: "replace", payload: { ...payload, input: { path: "safe.ts" } } }),
  });
  let seen: unknown;
  bus.register({
    step: "beforeToolUse",
    name: "observe",
    priority: 2,
    handler: (_ctx, payload) => {
      seen = payload.input;
      return { kind: "continue" };
    },
  });

  const { ctx } = setup();
  const result = await bus.run(ctx, "beforeToolUse", { tool: "read_file", input: { path: "secret.env" } });
  assert.deepEqual(seen, { path: "safe.ts" });
  assert.deepEqual(result.payload.input, { path: "safe.ts" });
});

test("the first denial stops the chain and later handlers cannot un-deny", async () => {
  const bus = new HookBus();
  let ranAfter = false;
  bus.register({ step: "beforeToolUse", name: "veto", priority: 1, handler: () => ({ kind: "deny", reason: "not allowed here" }) });
  bus.register({ step: "beforeToolUse", name: "after", priority: 2, handler: () => { ranAfter = true; return { kind: "continue" }; } });

  const { ctx } = setup();
  const result = await bus.run(ctx, "beforeToolUse", { tool: "run_command", input: {} });
  assert.equal(result.denied?.by, "veto");
  assert.equal(ranAfter, false);
});

test("`context` outcomes accumulate without changing the payload", async () => {
  const bus = new HookBus();
  bus.register({ step: "beforeSubmitPrompt", name: "a", handler: () => ({ kind: "context", text: "note A" }) });
  bus.register({ step: "beforeSubmitPrompt", name: "b", handler: () => ({ kind: "context", text: "note B" }) });

  const { ctx } = setup();
  const result = await bus.run(ctx, "beforeSubmitPrompt", { prompt: "hello" });
  assert.deepEqual(result.addedContext, ["note A", "note B"]);
  assert.equal(result.payload.prompt, "hello");
});

test("a throwing handler on a blocking step fails closed", async () => {
  const bus = new HookBus();
  bus.register({
    step: "beforeShellExecution",
    name: "crasher",
    handler: () => {
      throw new Error("hook exploded");
    },
  });

  const { ctx } = setup();
  const result = await bus.run(ctx, "beforeShellExecution", { command: "ls", cwd: "/repo" });
  assert.ok(result.denied, "a gate that crashed must not let the action through");
  assert.match(result.denied?.reason ?? "", /hook exploded/);
});

test("a throwing handler on a reporting step is skipped, not fatal", async () => {
  const bus = new HookBus();
  bus.register({
    step: "afterToolUse",
    name: "crasher",
    handler: () => {
      throw new Error("reporting failed");
    },
  });

  const { ctx } = setup();
  const result = await bus.run(ctx, "afterToolUse", { tool: "read_file", output: "ok", durationMs: 1 });
  assert.equal(result.denied, undefined);
});

test("`skip` mode lets a crashing gate through when that is the explicit choice", async () => {
  const bus = new HookBus({ onHandlerError: "skip" });
  bus.register({
    step: "beforeShellExecution",
    name: "crasher",
    handler: () => {
      throw new Error("boom");
    },
  });
  const { ctx } = setup();
  const result = await bus.run(ctx, "beforeShellExecution", { command: "ls", cwd: "/repo" });
  assert.equal(result.denied, undefined);
});

test("a hook that never returns is timed out and denied", async () => {
  const bus = new HookBus({ defaultTimeoutMs: 50 });
  bus.register({
    step: "beforeToolUse",
    name: "hangs",
    handler: () => new Promise(() => {}),
  });

  const clock = new ManualClock();
  const { ctx } = createRootContext({ clock });
  const pending = bus.run(ctx, "beforeToolUse", { tool: "run_command", input: {} });
  await clock.advance(60);
  const result = await pending;
  assert.match(result.denied?.reason ?? "", /exceeded 50ms/);
});

test("runOrThrow surfaces a denial as a typed error", async () => {
  const bus = new HookBus();
  bus.register({ step: "beforeToolUse", name: "veto", handler: () => ({ kind: "deny", reason: "no" }) });
  const { ctx } = setup();
  await assert.rejects(
    () => bus.runOrThrow(ctx, "beforeToolUse", { tool: "x", input: {} }),
    (error: unknown) => (error as AgentError).kind === "permission_denied",
  );
});

test("unregistering removes a handler", async () => {
  const bus = new HookBus();
  const off = bus.register({ step: "stop", name: "once", handler: () => ({ kind: "continue" }) });
  assert.equal(bus.count("stop"), 1);
  off();
  assert.equal(bus.count("stop"), 0);
});
