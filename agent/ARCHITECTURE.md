# Architecture

This document records what the runtime is made of, and — for each subsystem —
what was kept from the design it was modelled on and what was changed. The
source study is described under **Provenance** in [README.md](README.md).

## Layer map

```text
┌──────────────────────────────────────────────────────────────┐
│ AgentSession (src/loop/session.ts)                           │
│   run(prompt) → model call → tool calls → repeat → stop      │
│   stop reasons: completed max_steps no_progress denied        │
│                 cancelled error                               │
└───┬───────────┬───────────┬────────────────┬─────────────────┘
    │           │           │                │
    ▼           ▼           ▼                ▼
 HookBus   Permission   ToolRegistry   inference chain
           Broker                      (src/inference)
    │           │           │                │
    │           │           │                ▼
    │           │           │        InferenceRouter
    │           │           │        ├── CircuitBreaker (per provider)
    │           │           │        ├── UsageLedger (tokens → USD → budget)
    │           │           │        └── ChatProvider adapters
    │           │           │             anthropic · openai-compatible · mock
    │           │           │
    └───────────┴───────────┴──── RequestContext · TelemetrySink · BlobStore
```

`RequestContext` is threaded through every call. It carries cancellation, an
absolute deadline, the injectable clock and the telemetry lineage
(`traceId` / `spanId` / `parentSpanId`). `ctx.child({ timeoutMs })` narrows a
deadline and opens a span in one step; a child may tighten a deadline but never
extend it past its parent's.

## Request flow, one turn

```text
prompt
  │
  ├─ hook beforeSubmitPrompt ──────── deny ⇒ stop: denied
  ├─ hook beforeModelCall ─────────── deny ⇒ stop: denied
  │
  ├─ inference chain
  │    withTracing → withRetry → withTokenBudget → withCompaction
  │      └─ router: rank candidates → attempt → breaker → ledger
  │           failure ⇒ next provider, unless cancelled/budget/invalid_input
  │
  ├─ no tool calls, some text ─────── stop: completed
  ├─ no tool calls, no text (×N) ──── stop: no_progress
  │
  └─ for each tool call
       hook beforeToolUse ─ deny ⇒ tool result "Blocked by …"
       tool.validate(args) ─ throw ⇒ tool result "Invalid arguments: …"
       broker.check(action, command|path|url) ─ deny ⇒ "Permission denied: …"
       tool.execute(childCtx) ─ throw ⇒ "Tool failed (kind): …"
       hook afterToolUse
       checkpoint transcript
```

Two ordering decisions are load-bearing:

- **Validation precedes the permission check.** The broker matches on the
  concrete command or path, and those only exist once the arguments are known
  to be well formed.
- **A tool failure is a tool result, not an exception.** The model sees what
  went wrong and can adapt; only cancellation propagates and ends the run.

## Subsystems: kept vs. changed

### Inference routing

*Kept:* a router in front of several backends, with per-provider usage
accounting, and an explicit user choice of backend.

*Changed:* the explicit choice became one of three strategies
(`cheapest` / `priority` / `pinned`) rather than the only mode. Routing is
capability-first — a request needing tools never reaches a provider without
them. Each provider gets a circuit breaker, so a provider that is down ranks
last instead of costing a full timeout every turn. Failover is selective:
`cancelled` and `budget_exceeded` are the caller's decision and `invalid_input`
fails identically everywhere, so none of them fail over.

### Usage and cost

*Kept:* a per-provider ledger of requests and token counts, presented as local
activity records rather than an invoice.

*Changed:* tokens are priced into a USD estimate, cache reads are priced below
fresh input, and the ledger can carry a hard budget — it warns at 80% and
raises `budget_exceeded` at 100%, checked *before* a request is sent. A runaway
loop stops by itself.

### Middleware

*Kept:* the decorator shape — each middleware wraps the next and may alter the
request going in or the result coming out.

*Changed:* the chain wraps the **router**, not a single provider, so retry
composes with failover instead of fighting it. `withRetry` retries only what
was classified retryable at the throw site, and refuses a retry that cannot fit
inside the remaining deadline. `withCompaction` never cuts between an assistant
tool call and its results — the orphaned-`tool`-message 400 is the failure mode
a naive "keep the last N" window produces.

### Hooks

*Kept:* a named lifecycle step set covering shell execution, tool use, file
reads and edits, session start/end, compaction and subagents.

*Changed:* every step is typed — payload and outcome both — so a handler for
`beforeToolUse` cannot be handed a session payload. Handlers are ordered by
priority and bounded by a timeout. Outcomes are `continue`, `deny`, `replace`
or `context`, with deny-precedence and no un-denying. On a blocking step, a
handler that throws or hangs **denies** the action; a gate that exists to veto
something must not be defeated by crashing. Reporting steps skip a broken
handler instead.

### Permissions

*Kept:* three levels (`never` / `ask` / `always`) over a set of coarse actions,
clamped by an administrator ceiling that can only lower a user's choice.

*Changed:* decisions match on tool, command, path and URL through globs, so a
grant is as narrow as what was actually approved. Approvals carry a scope
(`once` / `session` / `persistent`), so approving something in one turn does
not silently become a standing grant. Deny beats allow whatever the rule order,
and an `ask` rule beats an `always` rule. A built-in list denies destructive
commands and credential paths regardless of configuration. With no prompter
reachable, `ask` resolves to deny. Every decision is recorded in an audit
ledger.

Globs, not regexes, for user rules: a mistyped glob fails closed, and no user
pattern can backtrack catastrophically. The built-in denials are authored in
this repository, so they use regexes — a glob cannot express "an `rm` with a
recursive flag *and* a system-directory target".

### State

*Kept:* content-addressed blobs keyed by SHA-256, with a distinction between
durable and local-only writes.

*Changed:* `get` re-hashes what it loaded and raises `integrity` on a mismatch.
Durability is a value on the write rather than a second method, and local blobs
are evicted under an LRU byte budget while durable ones are exempt. The
filesystem store writes to a temp file and renames, so a crash mid-write cannot
leave a truncated blob under a valid hash name. `AgentStore` adds namespacing,
snapshots (an id map, cheap to take and structurally shared) and
compare-and-set, because last-write-wins loses a subagent's work silently.

### Observability and privacy

*Kept:* structured events, metrics, and a privacy mode that scrubs sensitive
content.

*Changed:* redaction is applied by a sink **wrapper**, so adding a sink cannot
leak by omission, and every event carries request lineage so one turn can be
reassembled from an unordered log. The in-memory sink is explicitly lossy with
a drop counter rather than silently unbounded.

### Failure vocabulary

*New here.* Eleven error kinds (`cancelled`, `timeout`, `rate_limited`,
`provider_unavailable`, `provider_rejected`, `budget_exceeded`,
`permission_denied`, `invalid_input`, `not_found`, `integrity`, `internal`)
with `retryable` computed once at the throw site. Retry policy, failover policy
and the loop's stop reason all read that field instead of re-guessing from
message text.

## Not built

Named so the gaps are deliberate rather than implied:

- **Streaming.** Providers declare a `streaming` capability but adapters return
  complete responses. Adding it means a chunk type on `ChatProvider` and a
  passthrough in the middleware chain.
- **MCP.** Tools are registered in-process. An MCP client would register as
  another `ToolDefinition` source with `action: "mcp-call"`, which the
  permission model already carries.
- **Subagents.** The hook steps (`subagentStart` / `subagentStop`) and the
  store's compare-and-set exist for it; the spawning loop does not.
- **Sandboxing.** `run_command` gets an allow-listed environment, a process
  group and a timeout, not a container. Path containment covers the file tools.

## File map

| Path | Contents |
| --- | --- |
| `src/core/` | context, error registry, injectable clock |
| `src/telemetry/` | event/metric types, memory + console sinks, redacting wrapper |
| `src/redaction/` | secret patterns, privacy modes |
| `src/kv/` | content-addressed blob stores, namespaced typed store |
| `src/permission/` | levels and actions, glob rules, built-in denials, broker |
| `src/hooks/` | typed step set, ordered bus with timeouts |
| `src/router/` | provider contract, breaker, usage ledger, router, adapters |
| `src/inference/` | middleware chain and the four built-in middlewares |
| `src/tools/` | registry and the built-in tools |
| `src/loop/` | transcript and the turn loop |
| `src/build.ts` | default wiring |
| `cli.ts` | demo runner |
| `tests/` | 86 tests, deterministic, offline |
