import assert from "node:assert/strict";
import { test } from "node:test";

import { ManualClock } from "../src/core/clock.ts";
import { createRootContext } from "../src/core/context.ts";
import { AgentError, isRetryable, toAgentError } from "../src/core/errors.ts";
import { createRedactor } from "../src/redaction/redact.ts";
import { MemorySink, redacting } from "../src/telemetry/sink.ts";

test("error kinds decide retryability at the throw site", () => {
  assert.equal(new AgentError("rate_limited", "slow down").retryable, true);
  assert.equal(new AgentError("invalid_input", "bad shape").retryable, false);
  assert.equal(isRetryable(new Error("boom")), false);
  assert.equal(toAgentError(new Error("boom")).kind, "internal");
});

test("child context inherits the trace and tightens the deadline", () => {
  const clock = new ManualClock(1_000);
  const { ctx } = createRootContext({ clock, timeoutMs: 5_000 });
  const { ctx: child } = ctx.child({ timeoutMs: 60_000 });

  assert.equal(child.lineage.traceId, ctx.lineage.traceId);
  assert.equal(child.lineage.parentSpanId, ctx.lineage.spanId);
  // A child may not extend past the parent deadline.
  assert.equal(child.deadline, ctx.deadline);
});

test("cancelling a parent cancels its children", () => {
  const clock = new ManualClock();
  const { ctx, cancel } = createRootContext({ clock });
  const { ctx: child } = ctx.child();

  cancel("user stopped the run");
  assert.throws(() => child.throwIfDone(), (error: unknown) => (error as AgentError).kind === "cancelled");
});

test("a passed deadline reports as a timeout", async () => {
  const clock = new ManualClock(0);
  const { ctx } = createRootContext({ clock, timeoutMs: 100 });
  ctx.throwIfDone();
  await clock.advance(150);
  assert.throws(() => ctx.throwIfDone(), (error: unknown) => (error as AgentError).kind === "timeout");
  assert.equal(ctx.remainingMs(), 0);
});

test("redaction masks credentials and respects the privacy mode", () => {
  const balanced = createRedactor("balanced");
  const masked = balanced.text("use sk-ant-abcdefghijklmnopqrstuvwxyz012345 for the call");
  assert.match(masked, /\[redacted:anthropic_key\]/);
  assert.doesNotMatch(masked, /abcdefghijkl/);

  // Emails are only stripped at `strict`.
  assert.match(balanced.text("ping a@b.com"), /a@b\.com/);
  assert.match(createRedactor("strict").text("ping a@b.com"), /\[redacted:email\]/);

  // `off` is a genuine passthrough.
  assert.equal(createRedactor("off").text("sk-ant-aaaaaaaaaaaaaaaaaaaaaaaa"), "sk-ant-aaaaaaaaaaaaaaaaaaaaaaaa");
});

test("redaction drops sensitive keys wholesale and survives nesting", () => {
  const redactor = createRedactor("balanced");
  const cleaned = redactor.value({ headers: { authorization: "Bearer abc" }, note: "ghp_0123456789abcdefghij" });
  assert.deepEqual(cleaned, { headers: { authorization: "[redacted:key]" }, note: "[redacted:github_token]" });
});

test("the sink wrapper redacts every event, whoever emitted it", () => {
  const inner = new MemorySink();
  const clock = new ManualClock();
  const { ctx } = createRootContext({ clock, sink: redacting(inner, "balanced") });

  ctx.emit("info", "test.event", { key: "sk-ant-abcdefghijklmnopqrstuvwxyz012345" });

  const event = inner.named("test.event")[0];
  assert.ok(event);
  assert.equal(event.attributes["key"], "[redacted:anthropic_key]");
  assert.equal(event.lineage.traceId, ctx.lineage.traceId);
});

test("the memory sink is bounded and reports what it dropped", () => {
  const sink = new MemorySink(2);
  const { ctx } = createRootContext({ sink, clock: new ManualClock() });
  for (let i = 0; i < 5; i += 1) ctx.emit("debug", "spam", { i });
  assert.equal(sink.events.length, 2);
  assert.equal(sink.dropped().events, 3);
});
