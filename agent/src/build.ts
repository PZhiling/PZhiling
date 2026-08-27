import { systemClock, type Clock } from "./core/clock.ts";
import { HookBus } from "./hooks/bus.ts";
import { chain, withCompaction, withRetry, withTokenBudget, withTracing, type InferenceCall } from "./inference/middleware.ts";
import { AgentStore } from "./kv/agent-store.ts";
import { MemoryBlobStore } from "./kv/blob-store.ts";
import { AgentSession, type SessionOptions } from "./loop/session.ts";
import { PermissionBroker, type PermissionBrokerOptions } from "./permission/broker.ts";
import { AnthropicProvider } from "./router/providers/anthropic.ts";
import { MockProvider } from "./router/providers/mock.ts";
import { OpenAiCompatibleProvider } from "./router/providers/openai-compatible.ts";
import { InferenceRouter, type RegisteredProvider, type RouterOptions } from "./router/router.ts";
import { createFetchTool } from "./tools/builtin/fetch.ts";
import { createShellTool } from "./tools/builtin/shell.ts";
import { createWorkspaceTools } from "./tools/builtin/workspace.ts";
import { ToolRegistry, type ToolDefinition } from "./tools/registry.ts";

/**
 * Assembles the default agent: every layer wired the way the README describes,
 * with sensible middleware order. Each part is still constructible on its own —
 * this is a convenience, not a required entry point.
 */

export interface AgentBuildOptions {
  readonly workspace: string;
  readonly clock?: Clock;
  readonly providers?: readonly RegisteredProvider[];
  readonly router?: RouterOptions;
  readonly permissions?: PermissionBrokerOptions;
  readonly hooks?: HookBus;
  readonly extraTools?: readonly ToolDefinition<never>[];
  /** Omit the shell tool for a read-mostly agent. */
  readonly enableShell?: boolean;
  /** Omit the fetch tool, or pin it to an allow-list. */
  readonly enableFetch?: boolean;
  readonly allowedFetchHosts?: readonly string[];
  readonly session?: Omit<SessionOptions, "infer" | "tools" | "hooks" | "permissions" | "store">;
  /** Compact once the estimate crosses this many tokens. */
  readonly compactAtTokens?: number;
  readonly maxInputTokens?: number;
}

export interface BuiltAgent {
  readonly router: InferenceRouter;
  readonly tools: ToolRegistry;
  readonly hooks: HookBus;
  readonly permissions: PermissionBroker;
  readonly store: AgentStore;
  readonly infer: InferenceCall;
  newSession(): AgentSession;
}

/**
 * Providers from the environment, cheapest first, so a checkout with no keys
 * still runs end to end against the scripted provider.
 */
export function providersFromEnvironment(env: NodeJS.ProcessEnv = process.env): RegisteredProvider[] {
  const providers: RegisteredProvider[] = [];

  const anthropicKey = env["ANTHROPIC_API_KEY"];
  if (anthropicKey !== undefined && anthropicKey.length > 0) {
    providers.push({
      provider: new AnthropicProvider({ apiKey: anthropicKey, model: env["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-5" }),
      priority: 10,
    });
  }

  const openRouterKey = env["OPENROUTER_API_KEY"];
  if (openRouterKey !== undefined && openRouterKey.length > 0) {
    providers.push({
      provider: new OpenAiCompatibleProvider({
        id: "openrouter",
        apiKey: openRouterKey,
        model: env["OPENROUTER_MODEL"] ?? "openai/gpt-4o-mini",
        cost: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
      }),
      priority: 20,
    });
  }

  const openAiKey = env["OPENAI_API_KEY"];
  if (openAiKey !== undefined && openAiKey.length > 0) {
    providers.push({
      provider: new OpenAiCompatibleProvider({
        id: "openai",
        apiKey: openAiKey,
        baseUrl: "https://api.openai.com/v1",
        model: env["OPENAI_MODEL"] ?? "gpt-4o-mini",
        cost: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
      }),
      priority: 30,
    });
  }

  if (providers.length === 0) {
    providers.push({ provider: new MockProvider({ id: "offline" }), priority: 900 });
  }
  return providers;
}

export function buildAgent(options: AgentBuildOptions): BuiltAgent {
  const clock = options.clock ?? systemClock;

  const router = new InferenceRouter(clock, options.router);
  for (const registration of options.providers ?? providersFromEnvironment()) {
    router.register(registration);
  }

  const tools = new ToolRegistry();
  tools.registerAll(createWorkspaceTools({ root: options.workspace }));
  if (options.enableShell !== false) {
    tools.register(createShellTool({ cwd: options.workspace }));
  }
  if (options.enableFetch !== false) {
    tools.register(
      createFetchTool(
        options.allowedFetchHosts === undefined ? {} : { allowedHosts: options.allowedFetchHosts },
      ),
    );
  }
  if (options.extraTools !== undefined) tools.registerAll(options.extraTools);

  const hooks = options.hooks ?? new HookBus();
  const permissions = new PermissionBroker(
    options.permissions ?? {
      defaults: { "read-file": "always", "list-directory": "always" },
    },
  );
  const store = new AgentStore(new MemoryBlobStore(), "session");

  // Outermost first: trace everything, retry transient failures, refuse
  // oversized requests, then compact before the router sees them.
  const infer = chain(
    (ctx, request, requirements) => router.complete(ctx, request, requirements),
    withTracing(),
    withRetry(),
    withTokenBudget({ maxInputTokens: options.maxInputTokens ?? 400_000 }),
    withCompaction({ triggerTokens: options.compactAtTokens ?? 120_000 }),
  );

  return {
    router,
    tools,
    hooks,
    permissions,
    store,
    infer,
    newSession: () =>
      new AgentSession({
        ...options.session,
        infer,
        tools,
        hooks,
        permissions,
        store,
      }),
  };
}
