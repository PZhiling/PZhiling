import assert from "node:assert/strict";
import { test } from "node:test";

import { ManualClock } from "../src/core/clock.ts";
import { createRootContext } from "../src/core/context.ts";
import { AgentError } from "../src/core/errors.ts";
import { CircuitBreaker } from "../src/router/breaker.ts";
import { AnthropicProvider } from "../src/router/providers/anthropic.ts";
import { MockProvider } from "../src/router/providers/mock.ts";
import { InferenceRouter } from "../src/router/router.ts";
import { priceOf, UsageLedger } from "../src/router/usage.ts";

function harness(clock = new ManualClock()) {
  const { ctx } = createRootContext({ clock });
  return { ctx, clock };
}

const request = { messages: [{ role: "user" as const, content: "hello" }] };

test("the breaker opens after repeated failures and probes after the cooldown", async () => {
  const clock = new ManualClock();
  const breaker = new CircuitBreaker(clock, { failureThreshold: 2, cooldownMs: 1_000 });

  assert.ok(breaker.allow());
  breaker.onFailure();
  assert.equal(breaker.currentState(), "closed");
  breaker.onFailure();
  assert.equal(breaker.currentState(), "open");
  assert.ok(!breaker.allow());
  assert.equal(breaker.retryAfterMs(), 1_000);

  await clock.advance(1_000);
  assert.equal(breaker.currentState(), "half-open");
  assert.ok(breaker.allow(), "the first probe is admitted");
  assert.ok(!breaker.allow(), "a second concurrent probe is not");

  breaker.onSuccess();
  assert.equal(breaker.currentState(), "closed");
});

test("a failed probe re-opens the circuit immediately", async () => {
  const clock = new ManualClock();
  const breaker = new CircuitBreaker(clock, { failureThreshold: 1, cooldownMs: 500 });
  breaker.onFailure();
  await clock.advance(500);
  assert.ok(breaker.allow());
  breaker.onFailure();
  assert.equal(breaker.currentState(), "open");
});

test("the cheapest strategy prefers the cheaper provider", async () => {
  const { ctx, clock } = harness();
  const cheap = new MockProvider({ id: "cheap", cost: { inputPerMillion: 0.1, outputPerMillion: 0.4 } });
  const pricey = new MockProvider({ id: "pricey", cost: { inputPerMillion: 10, outputPerMillion: 30 } });

  const router = new InferenceRouter(clock).register({ provider: pricey }).register({ provider: cheap });
  const result = await router.complete(ctx, request);
  assert.equal(result.providerId, "cheap");
});

test("a provider lacking a capability is not offered", async () => {
  const { ctx, clock } = harness();
  const noTools = new MockProvider({ id: "no-tools", capabilities: { tools: false } });
  const withTools = new MockProvider({ id: "with-tools" });

  const router = new InferenceRouter(clock).register({ provider: noTools }).register({ provider: withTools });
  const result = await router.complete(ctx, request, { tools: true });
  assert.equal(result.providerId, "with-tools");
});

test("a failing provider fails over to the next and both attempts are reported", async () => {
  const { ctx, clock } = harness();
  const broken = new MockProvider({
    id: "broken",
    cost: { inputPerMillion: 0, outputPerMillion: 0 },
    script: [{ kind: "error", error: new AgentError("provider_unavailable", "down") }],
  });
  const healthy = new MockProvider({ id: "healthy", cost: { inputPerMillion: 1, outputPerMillion: 1 } });

  const router = new InferenceRouter(clock).register({ provider: broken }).register({ provider: healthy });
  const result = await router.complete(ctx, request);

  assert.equal(result.providerId, "healthy");
  assert.deepEqual(
    result.attempts.map((attempt) => [attempt.providerId, attempt.ok]),
    [["broken", false], ["healthy", true]],
  );
});

test("a repeatedly failing provider is skipped once its circuit opens", async () => {
  const { ctx, clock } = harness();
  const broken = new MockProvider({
    id: "broken",
    cost: { inputPerMillion: 0, outputPerMillion: 0 },
    fallback: { kind: "error", error: new AgentError("provider_unavailable", "down") },
  });
  const healthy = new MockProvider({ id: "healthy", cost: { inputPerMillion: 1, outputPerMillion: 1 } });

  const router = new InferenceRouter(clock, { breaker: { failureThreshold: 2, cooldownMs: 10_000 } })
    .register({ provider: broken })
    .register({ provider: healthy });

  await router.complete(ctx, request);
  await router.complete(ctx, request);
  const third = await router.complete(ctx, request);

  // Once the circuit is open the provider ranks last, so the third call goes
  // straight to the healthy one instead of paying for another failure.
  assert.equal(third.providerId, "healthy");
  assert.equal(third.attempts.length, 1);
  assert.equal(broken.seen.length, 2, "the open circuit stops further calls");
});

test("an invalid-input failure is not retried across providers", async () => {
  const { ctx, clock } = harness();
  const first = new MockProvider({
    id: "first",
    cost: { inputPerMillion: 0, outputPerMillion: 0 },
    script: [{ kind: "error", error: new AgentError("invalid_input", "bad request shape") }],
  });
  const second = new MockProvider({ id: "second", cost: { inputPerMillion: 1, outputPerMillion: 1 } });

  const router = new InferenceRouter(clock).register({ provider: first }).register({ provider: second });
  await assert.rejects(
    () => router.complete(ctx, request),
    (error: unknown) => (error as AgentError).kind === "invalid_input",
  );
  assert.equal(second.seen.length, 0, "the same malformed request is not sent onward");
});

test("cancellation is not treated as a provider fault", async () => {
  const { ctx, clock } = harness();
  const provider = new MockProvider({
    id: "p",
    script: [{ kind: "error", error: new AgentError("cancelled", "user stopped") }],
  });
  const other = new MockProvider({ id: "other" });
  const router = new InferenceRouter(clock).register({ provider }).register({ provider: other });

  await assert.rejects(
    () => router.complete(ctx, request),
    (error: unknown) => (error as AgentError).kind === "cancelled",
  );
  assert.equal(other.seen.length, 0);
});

test("pinning honours an explicit choice while keeping failover", async () => {
  const { ctx, clock } = harness();
  const cheap = new MockProvider({ id: "cheap", cost: { inputPerMillion: 0.1, outputPerMillion: 0.1 } });
  const pinned = new MockProvider({ id: "pinned", cost: { inputPerMillion: 5, outputPerMillion: 5 } });

  const router = new InferenceRouter(clock, { strategy: "pinned", pinnedProvider: "pinned" })
    .register({ provider: cheap })
    .register({ provider: pinned });

  assert.equal((await router.complete(ctx, request)).providerId, "pinned");
});

test("the ledger prices usage and stops the run at the budget", () => {
  const ledger = new UsageLedger({ budgetUsd: 0.01 });
  const cost = { inputPerMillion: 3, outputPerMillion: 15 };

  ledger.assertWithinBudget();
  ledger.record("p", { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 }, cost, 0);
  ledger.record("p", { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, cost, 1);

  assert.ok(ledger.spentUsd() >= 3);
  assert.throws(() => ledger.assertWithinBudget(), (error: unknown) => (error as AgentError).kind === "budget_exceeded");
  assert.equal(ledger.snapshot().providers["p"]?.requests, 2);
});

test("cache reads are priced below fresh input", () => {
  const cost = { inputPerMillion: 10, outputPerMillion: 10 };
  const fresh = priceOf({ inputTokens: 1000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, cost);
  const cached = priceOf({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 1000, cacheWriteTokens: 0 }, cost);
  assert.ok(cached < fresh);
});

test("a budget ceiling is enforced before a request is routed", async () => {
  const { ctx, clock } = harness();
  const provider = new MockProvider({ id: "p", cost: { inputPerMillion: 1_000_000, outputPerMillion: 0 } });
  const router = new InferenceRouter(clock, { ledger: { budgetUsd: 0.000_001 } }).register({ provider });

  await router.complete(ctx, request);
  await assert.rejects(
    () => router.complete(ctx, request),
    (error: unknown) => (error as AgentError).kind === "budget_exceeded",
  );
  assert.equal(provider.seen.length, 1);
});

test("the anthropic adapter sends the current thinking shape, not a token budget", async () => {
  const { ctx } = harness();
  const provider = new AnthropicProvider({ apiKey: "test-key" });

  // Intercept the wire request rather than calling the API.
  let sent: Record<string, unknown> | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        type: "message",
        model: "claude-opus-5",
        stop_reason: "end_turn",
        content: [{ type: "text", text: "hi" }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof globalThis.fetch;

  try {
    await provider.complete(ctx, { ...request, effort: "xhigh" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(sent);
  assert.deepEqual(sent["thinking"], { type: "adaptive" });
  assert.deepEqual(sent["output_config"], { effort: "xhigh" });
  // `budget_tokens` is rejected with a 400 on current models.
  assert.equal(JSON.stringify(sent).includes("budget_tokens"), false);
  assert.equal(provider.model, "claude-opus-5");
});
