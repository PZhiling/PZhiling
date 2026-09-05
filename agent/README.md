# Zhiling Agent Core

A dependency-free TypeScript agent runtime: routed inference with failover, a
typed lifecycle hook bus, a permission broker with rule matching and scoped
grants, content-addressed session state, and a tool loop that reports why it
stopped.

Runs on plain Node 22+ with native type stripping — no build step, no
`node_modules`, no lockfile.

```bash
node --experimental-strip-types --test agent/tests/*.test.ts   # 86 tests
node --experimental-strip-types agent/cli.ts "summarise this repo"
```

## ภาพรวม (ภาษาไทย)

โมดูลนี้คือ *agent runtime* ที่เขียนขึ้นใหม่ทั้งหมด โดยศึกษาแนวสถาปัตยกรรมของ
เดสก์ท็อป AI agent ที่มีอยู่ (ดูหัวข้อ **Provenance**) แล้วนำ *แนวคิดเชิงโครงสร้าง*
มาออกแบบใหม่ให้ดีกว่าเดิม ไม่ได้คัดลอกโค้ดจากที่ใด

ส่วนที่ปรับปรุงจากของเดิม:

| ของเดิม | เวอร์ชันนี้ |
| --- | --- |
| เลือกผู้ให้บริการ AI เองในหน้า Settings | เลือกอัตโนมัติตามความสามารถ/ราคา + สลับให้เองเมื่อเจ้าหนึ่งล่ม (circuit breaker) |
| นับ token ไว้ดูเฉยๆ | คิดราคาเป็น USD และ **หยุดงานเอง** เมื่อชนเพดานงบ |
| สิทธิ์ 3 ระดับ × 5 การกระทำ | จับคู่ตามคำสั่ง/พาธจริง + ขอบเขตการอนุญาต (ครั้งเดียว/เซสชัน/ถาวร) + audit log |
| hook ใช้ payload ก้อนเดียวกันหมด | hook มี type แยกต่อจุด และ **ปิดกั้นไว้ก่อน** เมื่อ hook พัง |
| เก็บ blob ตาม hash | ตรวจ hash ซ้ำตอนอ่าน จับไฟล์เสียได้ทันที |
| จบงานแล้วไม่บอกเหตุผล | บอกเสมอว่าหยุดเพราะอะไร (6 แบบ) |

---

## Why this exists

Agent runtimes tend to grow the same handful of subsystems, and the interesting
question is not *whether* to have them but what each one does when things go
wrong. This is a compact, readable implementation of that set, with the failure
behaviour chosen deliberately and covered by tests.

## Layers

```text
AgentSession ─ turn loop: model call → tool calls → stop reason
  ├── HookBus ────────── typed lifecycle steps; deny / replace / context
  ├── PermissionBroker ─ rule matching, scoped grants, audit ledger
  ├── ToolRegistry ───── each tool declares its permission action
  └── inference chain ── tracing → retry → budget → compaction
        └── InferenceRouter ─ capability routing, failover, breaker, ledger
              └── providers: Anthropic · OpenAI-compatible · scripted mock

cross-cutting: RequestContext (cancellation + deadline + lineage)
               TelemetrySink (redaction applied at the sink)
               BlobStore / AgentStore (content-addressed state)
```

## Quick start

```ts
import { buildAgent, createRootContext, ConsoleSink } from "./agent/src/index.ts";

const agent = buildAgent({
  workspace: process.cwd(),
  permissions: {
    defaults: { "read-file": "always", "list-directory": "always" },
    rules: [
      { id: "tests", level: "always", actions: ["run-command"], command: "npm test*" },
      { id: "no-lockfile", level: "never", actions: ["write-file"], path: "**/package-lock.json" },
    ],
    prompter: async () => ({ approved: true, scope: "session" }),
  },
});

const { ctx } = createRootContext({ sink: new ConsoleSink("info"), timeoutMs: 300_000 });
const session = agent.newSession();

await session.start(ctx);
const result = await session.run(ctx, "add a test for the retry middleware");
await session.end(ctx);

console.log(result.stopReason, result.steps, result.estimatedCostUsd);
```

Providers are picked up from the environment — `ANTHROPIC_API_KEY`,
`OPENROUTER_API_KEY`, `OPENAI_API_KEY` (override the model with
`ANTHROPIC_MODEL` / `OPENROUTER_MODEL` / `OPENAI_MODEL`). With none set, a
scripted provider runs the whole loop offline.

The Anthropic adapter defaults to `claude-opus-5` and maps `effort`
(`low` … `max`) onto adaptive thinking plus `output_config.effort`.

## The parts

### Router

Providers register with their capabilities (tools, vision, context window) and
their price. Each request is routed to the cheapest healthy provider that
satisfies it; a failure fails over to the next and trips a per-provider circuit
breaker so a provider that is down stops costing a full timeout every turn.

`cancelled`, `budget_exceeded` and `invalid_input` deliberately do *not* fail
over — the first two are the caller's decision, and a malformed request fails
identically everywhere.

### Usage ledger

Records requests, tokens and a USD estimate per provider, warns at 80% of a
configured budget, and raises `budget_exceeded` at 100% *before* the next
request is sent. Figures are local activity records, not an invoice.

### Inference middleware

A decorator chain around the router, outermost first:

- `withTracing` — one event per call, with the route taken and the cost.
- `withRetry` — retries only errors classified retryable at the throw site,
  with full jitter, honouring `retry-after`, and skipping a retry that cannot
  fit inside the remaining deadline.
- `withTokenBudget` — rejects an oversized request and caps output length.
- `withCompaction` — drops the middle of a long transcript, keeping the system
  prompt and recent tail, and never orphans a tool result from its call.

### Hook bus

Seventeen typed lifecycle steps. A handler returns `continue`, `deny`,
`replace` (rewrite the payload for later handlers and the action itself) or
`context` (append guidance). The first denial stops the chain. Handlers have a
timeout, and on a *blocking* step a handler that throws or hangs denies the
action — a gate must not be defeated by crashing.

### Permission broker

Three levels (`never` / `ask` / `always`) over seven actions, clamped by an
optional administrator ceiling that can only lower a choice. On top of that:

- rules match on tool, command, path and URL via globs, so "always allow
  `git status`" does not also allow `git push`;
- an approval carries a scope — `once`, `session` or `persistent`;
- deny always beats allow, and an `ask` rule beats an `always` rule;
- a built-in list denies destructive commands and credential paths regardless
  of configuration (a guard against the common accident, not a security
  boundary);
- with no prompter reachable, `ask` resolves to deny;
- every decision lands in an audit ledger.

### Tools

Each tool declares the permission action it performs and derives the concrete
permission request from its own validated arguments, so a new tool cannot
forget to be policed. Built in: `read_file`, `write_file`, `list_directory`,
`search_text`, `run_command`, `fetch_url`.

`run_command` runs in a detached process group so a timeout kills the whole
tree, and its environment is allow-listed rather than inherited — a command
that needs `PATH` should not be handed your provider keys.

`fetch_url` refuses non-HTTP schemes, credentials in the URL and off-list
hosts, and does not follow redirects (following them would let an allowed host
bounce the agent to a denied one).

### State

`BlobStore` is content-addressed on SHA-256 and **re-hashes on read**, so
corruption surfaces as an `integrity` error instead of as a confusing model
failure three layers away. Blobs are `local` (evictable under an LRU byte
budget) or `durable` (exempt). `AgentStore` layers a namespaced typed KV over
it with snapshots and compare-and-set.

### Session loop

Runs until the model stops asking for tools, and always reports why:
`completed`, `max_steps`, `no_progress`, `denied`, `cancelled`, `error`. Each
tool call is gated in a fixed order — hook → validate → permission → execute —
and every failure becomes a tool result the model can react to rather than an
exception that ends the run. The transcript is checkpointed after each step.

## Testing

```bash
node --experimental-strip-types --test agent/tests/*.test.ts
```

86 tests, no network and no sleeping: a `ManualClock` drives retry backoff,
hook timeouts and circuit-breaker cooldowns deterministically.

Type checking needs only `tsc`:

```bash
cd agent && npm install --no-save typescript @types/node && npx tsc -p tsconfig.json
```

## Provenance

The architecture was studied from
[`b-nnett/grok-bot-0.18-reconstructed`](https://github.com/b-nnett/grok-bot-0.18-reconstructed),
an unofficial reverse-engineered reconstruction of a shipped desktop AI agent.
What was taken from it is *structural*: the idea of an inference router, a
middleware chain over the prompt executor, a named lifecycle hook set, a
permission level/ceiling model, and content-addressed agent state.

No code was copied. Every file here is an original implementation, the
subsystems that were kept were re-specified with different failure behaviour
(see the table at the top), and nothing depends on, links against, or
redistributes any part of that project or the application it reconstructs.
