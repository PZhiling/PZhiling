/**
 * Zhiling Agent Core — public surface.
 *
 * The layering, top to bottom:
 *
 *   session (loop)      turn loop, stop conditions, transcript
 *     ├── hooks         typed lifecycle bus, deny/replace/context outcomes
 *     ├── permission    rule matching, scoped grants, audit ledger
 *     ├── tools         declarative registry; each tool names its action
 *     └── inference     middleware chain over the router
 *           └── router  capability routing, failover, breaker, usage ledger
 *                 └── providers
 *
 * Cross-cutting: `core` (context, errors, clock), `telemetry` (+ redaction),
 * `kv` (content-addressed state).
 */

export { createRootContext, type RequestContext, type RootContextOptions } from "./core/context.ts";
export { ManualClock, systemClock, type Clock } from "./core/clock.ts";
export {
  AgentError,
  ERROR_KINDS,
  errorKindOf,
  isAgentError,
  isRetryable,
  toAgentError,
  type ErrorKind,
} from "./core/errors.ts";

export { ConsoleSink, MemorySink, fanOut, nullSink, redacting, type TelemetrySink } from "./telemetry/sink.ts";
export type { EventLevel, Lineage, MetricSample, TelemetryEvent } from "./telemetry/events.ts";
export { createRedactor, DEFAULT_RULES, PRIVACY_MODES, type PrivacyMode } from "./redaction/redact.ts";

export { blobIdOf, FileBlobStore, MemoryBlobStore, type BlobId, type BlobStore, type Durability } from "./kv/blob-store.ts";
export { AgentStore, type Snapshot, type StoredValue } from "./kv/agent-store.ts";

export {
  clampToCeiling,
  MUTATING_ACTIONS,
  PERMISSION_LEVELS,
  TOOL_ACTIONS,
  type GrantScope,
  type PermissionLevel,
  type PermissionOutcome,
  type PermissionRequest,
  type ToolAction,
} from "./permission/model.ts";
export {
  BUILTIN_DENY_RULES,
  builtinDenyFor,
  globToRegExp,
  ruleMatches,
  type BuiltinDeny,
  type PermissionRule,
} from "./permission/rules.ts";
export { PermissionBroker, type AuditEntry, type PermissionPrompter } from "./permission/broker.ts";

export { HOOK_STEPS, type HookOutcome, type HookPayloads, type HookStep } from "./hooks/steps.ts";
export { HookBus, type HookHandler, type HookRegistration, type HookResult } from "./hooks/bus.ts";

export {
  EFFORT_LEVELS,
  estimateRequestTokens,
  estimateTokens,
  type Effort,
  type ChatMessage,
  type ChatProvider,
  type ChatRequest,
  type ChatResponse,
  type ProviderCapabilities,
  type ProviderCost,
  type ToolCall,
  type ToolSchema,
  type Usage,
} from "./router/provider.ts";
export { CircuitBreaker, type BreakerOptions, type BreakerState } from "./router/breaker.ts";
export { priceOf, UsageLedger, type ProviderUsage, type UsageSnapshot } from "./router/usage.ts";
export {
  InferenceRouter,
  type RouteAttempt,
  type RouteRequirements,
  type RouteResult,
  type RouterOptions,
  type RoutingStrategy,
} from "./router/router.ts";
export { MockProvider, type MockProviderOptions, type ScriptedTurn } from "./router/providers/mock.ts";
export { OpenAiCompatibleProvider, type OpenAiCompatibleOptions } from "./router/providers/openai-compatible.ts";
export {
  AnthropicProvider,
  DEFAULT_ANTHROPIC_COST,
  DEFAULT_ANTHROPIC_MODEL,
  type AnthropicProviderOptions,
} from "./router/providers/anthropic.ts";

export {
  chain,
  withCompaction,
  withRetry,
  withTokenBudget,
  withTracing,
  type InferenceCall,
  type InferenceMiddleware,
} from "./inference/middleware.ts";

export {
  optionalBoolean,
  optionalNumber,
  optionalString,
  requireString,
  ToolRegistry,
  type ToolDefinition,
  type ToolResult,
} from "./tools/registry.ts";
export {
  createListDirectoryTool,
  createReadFileTool,
  createSearchTool,
  createWorkspaceTools,
  createWriteFileTool,
  resolveInside,
  type WorkspaceOptions,
} from "./tools/builtin/workspace.ts";
export { createShellTool, type ShellToolOptions } from "./tools/builtin/shell.ts";
export { createFetchTool, type FetchToolOptions } from "./tools/builtin/fetch.ts";

export { Transcript } from "./loop/transcript.ts";
export {
  AgentSession,
  type RunResult,
  type SessionOptions,
  type StopReason,
  type ToolRecord,
} from "./loop/session.ts";

export {
  buildAgent,
  providersFromEnvironment,
  type AgentBuildOptions,
  type BuiltAgent,
} from "./build.ts";
