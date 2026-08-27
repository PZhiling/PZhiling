/**
 * Demo CLI for Zhiling Agent Core.
 *
 *   node --experimental-strip-types agent/cli.ts "list the files and summarise the README"
 *
 * With no provider key set it runs against the scripted offline provider, so
 * the loop, hooks, permissions and tools are all exercisable with nothing
 * installed and nothing to pay for.
 */

import { createInterface } from "node:readline/promises";

import { buildAgent, providersFromEnvironment } from "./src/build.ts";
import { createRootContext } from "./src/core/context.ts";
import { MockProvider } from "./src/router/providers/mock.ts";
import { ConsoleSink, fanOut, MemorySink, redacting } from "./src/telemetry/sink.ts";
import type { PermissionPrompter } from "./src/permission/broker.ts";
import type { PrivacyMode } from "./src/redaction/redact.ts";

function parseArguments(argv: readonly string[]): { prompt: string; verbose: boolean; yes: boolean } {
  const rest: string[] = [];
  let verbose = false;
  let yes = false;
  for (const argument of argv) {
    if (argument === "--verbose" || argument === "-v") verbose = true;
    else if (argument === "--yes" || argument === "-y") yes = true;
    else rest.push(argument);
  }
  return { prompt: rest.join(" "), verbose, yes };
}

/** Asks on the terminal. Anything but an explicit `y` is a refusal. */
function terminalPrompter(autoApprove: boolean): PermissionPrompter {
  return async (_ctx, request, reason) => {
    const target = request.command ?? request.path ?? request.url ?? "";
    if (autoApprove) {
      process.stderr.write(`[auto-approved] ${request.tool}: ${target}\n`);
      return { approved: true, scope: "session" };
    }
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    try {
      const answer = await rl.question(`\nAllow ${request.tool} (${reason})?\n  ${target}\n[y/N/a=always this session] `);
      const normalized = answer.trim().toLowerCase();
      if (normalized === "a") return { approved: true, scope: "session" };
      return { approved: normalized === "y" || normalized === "yes", scope: "once" };
    } finally {
      rl.close();
    }
  };
}

async function main(): Promise<void> {
  const { prompt, verbose, yes } = parseArguments(process.argv.slice(2));
  if (prompt.length === 0) {
    process.stderr.write("usage: cli.ts [--verbose] [--yes] <prompt>\n");
    process.exitCode = 2;
    return;
  }

  const privacy: PrivacyMode = (process.env["ZHILING_PRIVACY"] as PrivacyMode) ?? "balanced";
  const memory = new MemorySink();
  const sink = redacting(
    verbose ? fanOut(memory, new ConsoleSink("debug")) : fanOut(memory, new ConsoleSink("warn")),
    privacy,
  );

  const workspace = process.cwd();
  const fromEnvironment = providersFromEnvironment();
  const offline = fromEnvironment.some(({ provider }) => provider instanceof MockProvider);
  // Offline, script a short tool loop so the demo shows the machinery working
  // rather than a single canned sentence.
  const providers = offline
    ? [
        {
          provider: new MockProvider({
            id: "offline",
            script: [
              { kind: "tool", calls: [{ name: "list_directory", arguments: { path: "." } }] },
              { kind: "tool", calls: [{ name: "read_file", arguments: { path: "README.md", maxLines: 20 } }] },
              {
                kind: "text",
                text:
                  "Offline demo: listed the workspace, read the top of README.md, and stopped. " +
                  "Set ANTHROPIC_API_KEY, OPENROUTER_API_KEY or OPENAI_API_KEY to run this for real.",
              },
            ],
          }),
        },
      ]
    : fromEnvironment;

  const agent = buildAgent({
    workspace,
    providers,
    permissions: {
      defaults: { "read-file": "always", "list-directory": "always" },
      prompter: terminalPrompter(yes),
    },
    session: {
      systemPrompt: [
        "You are a careful engineering assistant working inside a single workspace.",
        "Prefer reading before writing. Explain what you changed and why.",
      ].join(" "),
      maxSteps: 10,
    },
  });

  if (offline) {
    process.stderr.write(
      "No provider key found (ANTHROPIC_API_KEY / OPENROUTER_API_KEY / OPENAI_API_KEY).\n" +
        "Running against the offline scripted provider.\n\n",
    );
  }

  const { ctx, cancel } = createRootContext({ sink, timeoutMs: 10 * 60_000 });
  process.on("SIGINT", () => cancel("interrupted"));

  const session = agent.newSession();
  await session.start(ctx);
  const result = await session.run(ctx, prompt);
  await session.end(ctx);

  process.stdout.write(`\n${result.text}\n`);
  process.stderr.write(
    `\n--- ${result.stopReason} | ${result.steps} step(s) | ` +
      `${result.toolCalls.length} tool call(s) | $${result.estimatedCostUsd.toFixed(4)} ---\n`,
  );
  for (const call of result.toolCalls) {
    process.stderr.write(`  ${call.ok ? "ok  " : "fail"} ${call.tool} (${call.durationMs}ms)\n`);
  }
  if (result.error !== undefined) {
    process.stderr.write(`error: ${result.error.kind}: ${result.error.message}\n`);
    process.exitCode = 1;
  }
}

await main();
