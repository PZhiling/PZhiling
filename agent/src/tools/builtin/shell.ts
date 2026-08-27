import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { AgentError } from "../../core/errors.ts";
import { optionalNumber, requireString, type ToolDefinition, type ToolResult } from "../registry.ts";

/**
 * Shell tool.
 *
 * Runs through `/bin/sh -c` in a detached process group so a timeout can kill
 * the whole tree — killing only the shell leaves orphaned children holding the
 * pipes open, which is how a "timed out" command keeps burning a machine.
 *
 * The environment is allow-listed rather than inherited: the process
 * environment of an agent host routinely holds provider keys, and a command
 * that only needs `PATH` should not be handed them.
 */

export interface ShellToolOptions {
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly maxOutputChars?: number;
  /** Environment variables passed through to the child. */
  readonly allowedEnv?: readonly string[];
  readonly extraEnv?: Readonly<Record<string, string>>;
}

const DEFAULT_ALLOWED_ENV = ["PATH", "HOME", "LANG", "LC_ALL", "TZ", "TERM", "SHELL", "TMPDIR"] as const;

export function createShellTool(options: ShellToolOptions): ToolDefinition<{ command: string; timeoutMs: number }> {
  const cwd = resolve(options.cwd);
  const defaultTimeoutMs = options.timeoutMs ?? 60_000;
  const maxOutputChars = options.maxOutputChars ?? 30_000;
  const allowed = options.allowedEnv ?? DEFAULT_ALLOWED_ENV;

  return {
    name: "run_command",
    description: "Run a shell command in the workspace and return its combined output and exit code.",
    action: "run-command",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Command line to execute." },
        timeoutMs: { type: "number", description: "Timeout in milliseconds." },
      },
      required: ["command"],
      additionalProperties: false,
    },
    validate: (raw) => ({
      command: requireString(raw, "command"),
      timeoutMs: optionalNumber(raw, "timeoutMs", defaultTimeoutMs),
    }),
    describe: (input) => ({ command: input.command, path: cwd }),
    execute: async (ctx, input): Promise<ToolResult> => {
      ctx.throwIfDone();
      const budget = Math.min(input.timeoutMs, defaultTimeoutMs, Math.max(1_000, ctx.remainingMs()));

      const env: Record<string, string> = {};
      for (const key of allowed) {
        const value = process.env[key];
        if (value !== undefined) env[key] = value;
      }
      Object.assign(env, options.extraEnv ?? {});

      const child = spawn("/bin/sh", ["-c", input.command], {
        cwd,
        env,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let output = "";
      let overflow = 0;
      const collect = (chunk: Buffer): void => {
        const text = chunk.toString("utf8");
        if (output.length < maxOutputChars) output += text;
        else overflow += text.length;
      };
      child.stdout.on("data", collect);
      child.stderr.on("data", collect);

      let timedOut = false;
      const killTree = (signal: NodeJS.Signals): void => {
        if (child.pid === undefined) return;
        try {
          process.kill(-child.pid, signal);
        } catch {
          child.kill(signal);
        }
      };
      const timer = setTimeout(() => {
        timedOut = true;
        killTree("SIGTERM");
        // A process ignoring SIGTERM gets a short grace period, then SIGKILL.
        setTimeout(() => killTree("SIGKILL"), 2_000).unref();
      }, budget);
      const onAbort = (): void => killTree("SIGKILL");
      ctx.signal.addEventListener("abort", onAbort, { once: true });

      const exitCode = await new Promise<number>((resolveExit, rejectExit) => {
        child.on("error", (error) =>
          rejectExit(new AgentError("internal", "failed to start the command", { cause: error })),
        );
        child.on("close", (code, signal) => resolveExit(code ?? (signal === null ? -1 : 128)));
      }).finally(() => {
        clearTimeout(timer);
        ctx.signal.removeEventListener("abort", onAbort);
      });

      ctx.throwIfDone();
      const suffix =
        overflow > 0 ? `\n... [${overflow} further characters suppressed]` : "";
      const banner = timedOut ? `[command timed out after ${budget}ms]\n` : "";
      return {
        output: `${banner}${output.slice(0, maxOutputChars)}${suffix}\n[exit ${exitCode}]`,
        isError: timedOut || exitCode !== 0,
        metadata: { exitCode, timedOut, outputChars: output.length },
      };
    },
  };
}
