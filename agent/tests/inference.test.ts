import assert from "node:assert/strict";
import { test } from "node:test";

import { ManualClock } from "../src/core/clock.ts";
import { createRootContext } from "../src/core/context.ts";
import { AgentError } from "../src/core/errors.ts";
import { chain, withCompaction, withRetry, withTokenBudget, type InferenceCall } from "../src/inference/middleware.ts";
import type { ChatMessage, ChatRequest } from "../src/router/provider.ts";
import type { RouteResult } from "../src/router/router.ts";

function okResult(): RouteResult {
  return {
    response: {
      text: "ok",
      toolCalls: [],
      usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
      model: "test",
      stopReason: "stop",
    },
    providerId: "test",
    attempts: [],
    estimatedCostUsd: 0,
  };
}

const request: ChatRequest = { messages: [{ role: "user", content: "hi" }] };

/**
 * Drive the manual clock forward until `promise` settles. Retry delays are
 * computed inside the middleware, so a test cannot know in advance how far to
 * advance; stepping until the work finishes keeps the test deterministic
 * without hard-coding the backoff schedule.
 */
async function settle<T>(clock: ManualClock, promise: Promise<T>): Promise<T> {
  let settled = false;
  promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  for (let step = 0; step < 50 && !settled; step += 1) {
    await clock.advance(1_000);
  }
  return promise;
}

test("retry gives up immediately on a non-retryable failure", async () => {
  const clock = new ManualClock();
  const { ctx } = createRootContext({ clock });
  let calls = 0;
  const call = chain(
    async () => {
      calls += 1;
      throw new AgentError("provider_rejected", "bad credentials");
    },
    withRetry({ maxAttempts: 5, random: () => 0 }),
  );

  await assert.rejects(() => call(ctx, request, {}));
  assert.equal(calls, 1);
});

test("retry backs off and eventually succeeds", async () => {
  const clock = new ManualClock();
  const { ctx } = createRootContext({ clock });
  let calls = 0;
  const call = chain(
    async () => {
      calls += 1;
      if (calls < 3) throw new AgentError("rate_limited", "slow down", { retryAfterMs: 100 });
      return okResult();
    },
    withRetry({ maxAttempts: 5, random: () => 0 }),
  );

  const result = await settle(clock, call(ctx, request, {}));
  assert.equal(result.providerId, "test");
  assert.equal(calls, 3);
});

test("a retry that cannot fit inside the deadline is not attempted", async () => {
  const clock = new ManualClock();
  const { ctx } = createRootContext({ clock, timeoutMs: 50 });
  const call = chain(
    async () => {
      throw new AgentError("rate_limited", "slow down", { retryAfterMs: 5_000 });
    },
    withRetry({ maxAttempts: 3, random: () => 0 }),
  );

  await assert.rejects(
    () => call(ctx, request, {}),
    (error: unknown) => (error as AgentError).kind === "timeout",
  );
});

test("the token budget rejects an oversized request before it is sent", async () => {
  const clock = new ManualClock();
  const { ctx } = createRootContext({ clock });
  let sent = 0;
  const call = chain(
    async () => {
      sent += 1;
      return okResult();
    },
    withTokenBudget({ maxInputTokens: 10 }),
  );

  await assert.rejects(
    () => call(ctx, { messages: [{ role: "user", content: "x".repeat(1000) }] }, {}),
    (error: unknown) => (error as AgentError).kind === "budget_exceeded",
  );
  assert.equal(sent, 0);
});

test("the token budget caps the requested output length", async () => {
  const clock = new ManualClock();
  const { ctx } = createRootContext({ clock });
  let seen: ChatRequest | undefined;
  const call: InferenceCall = chain(
    async (_ctx, forwarded) => {
      seen = forwarded;
      return okResult();
    },
    withTokenBudget({ maxOutputTokens: 512 }),
  );

  await call(ctx, { ...request, maxOutputTokens: 8_000 }, {});
  assert.equal(seen?.maxOutputTokens, 512);
});

test("compaction keeps the system prompt and the recent tail", async () => {
  const clock = new ManualClock();
  const { ctx } = createRootContext({ clock });
  const messages: ChatMessage[] = [
    { role: "system", content: "you are a careful agent" },
    ...Array.from({ length: 40 }, (_unused, index) => ({
      role: (index % 2 === 0 ? "user" : "assistant") as ChatMessage["role"],
      content: `message ${index} ${"padding ".repeat(40)}`,
    })),
  ];

  let seen: ChatRequest | undefined;
  const call = chain(
    async (_ctx, forwarded) => {
      seen = forwarded;
      return okResult();
    },
    withCompaction({ triggerTokens: 100, keepRecent: 4 }),
  );

  await call(ctx, { messages }, {});

  assert.ok(seen);
  assert.equal(seen.messages[0]?.content, "you are a careful agent");
  assert.equal(seen.messages[1]?.role, "system");
  assert.match(seen.messages[1]?.content ?? "", /compacted/);
  assert.equal(seen.messages.length, 6, "system + summary + the last four turns");
  assert.match(seen.messages[5]?.content ?? "", /message 39/);
});

test("compaction never orphans a tool result from its call", async () => {
  const clock = new ManualClock();
  const { ctx } = createRootContext({ clock });
  const filler = "padding ".repeat(60);
  const messages: ChatMessage[] = [
    { role: "user", content: `start ${filler}` },
    { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "read_file", arguments: {} }] },
    { role: "tool", content: `result one ${filler}`, toolCallId: "c1" },
    { role: "tool", content: `result two ${filler}`, toolCallId: "c1" },
    { role: "assistant", content: `answer ${filler}` },
  ];

  let seen: ChatRequest | undefined;
  const call = chain(
    async (_ctx, forwarded) => {
      seen = forwarded;
      return okResult();
    },
    // keepRecent 2 would cut right before a `tool` message.
    withCompaction({ triggerTokens: 10, keepRecent: 2 }),
  );

  await call(ctx, { messages }, {});

  assert.ok(seen);
  const kept = seen.messages.filter((message) => message.role !== "system");
  assert.ok(
    kept.every((message) => message.role !== "tool"),
    "the cut moved past the tool results instead of leaving one orphaned",
  );
});

test("a transcript under the trigger is passed through untouched", async () => {
  const clock = new ManualClock();
  const { ctx } = createRootContext({ clock });
  let seen: ChatRequest | undefined;
  const call = chain(
    async (_ctx, forwarded) => {
      seen = forwarded;
      return okResult();
    },
    withCompaction({ triggerTokens: 1_000_000 }),
  );

  await call(ctx, request, {});
  assert.deepEqual(seen?.messages, request.messages);
});

test("middleware order is outermost-first", async () => {
  const clock = new ManualClock();
  const { ctx } = createRootContext({ clock });
  const order: string[] = [];
  const label = (name: string) => (next: InferenceCall): InferenceCall => async (c, r, q) => {
    order.push(name);
    return next(c, r, q);
  };

  const call = chain(async () => okResult(), label("first"), label("second"), label("third"));
  await call(ctx, request, {});
  assert.deepEqual(order, ["first", "second", "third"]);
});
