import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import type { RequestContext } from "../../core/context.ts";
import { AgentError } from "../../core/errors.ts";
import {
  optionalBoolean,
  optionalNumber,
  optionalString,
  requireString,
  type ToolDefinition,
  type ToolResult,
} from "../registry.ts";

/**
 * Filesystem tools scoped to a workspace root.
 *
 * The permission broker is the policy layer; this is the containment layer.
 * Both exist because they fail differently: a rule list can be misconfigured,
 * and a path check cannot express intent. `resolveInside` is the one function
 * every file tool goes through, so `../` traversal is rejected in a single
 * place rather than per tool.
 */

export interface WorkspaceOptions {
  readonly root: string;
  /** Refuse to read or write files larger than this. */
  readonly maxFileBytes?: number;
  /** Truncate tool output beyond this many characters. */
  readonly maxOutputChars?: number;
}

interface ResolvedOptions {
  readonly root: string;
  readonly maxFileBytes: number;
  readonly maxOutputChars: number;
}

function resolveOptions(options: WorkspaceOptions): ResolvedOptions {
  return {
    root: resolve(options.root),
    maxFileBytes: options.maxFileBytes ?? 2 * 1024 * 1024,
    maxOutputChars: options.maxOutputChars ?? 30_000,
  };
}

export function resolveInside(root: string, candidate: string): string {
  const absolute = isAbsolute(candidate) ? resolve(candidate) : resolve(root, candidate);
  const rel = relative(root, absolute);
  if (rel.startsWith("..") || (rel !== "" && isAbsolute(rel))) {
    throw new AgentError("permission_denied", "path escapes the workspace root", {
      details: { path: candidate },
    });
  }
  return absolute;
}

function truncate(text: string, limit: number): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  return {
    text: `${text.slice(0, limit)}\n... [truncated ${text.length - limit} characters]`,
    truncated: true,
  };
}

export function createReadFileTool(options: WorkspaceOptions): ToolDefinition<{ path: string; maxLines: number }> {
  const config = resolveOptions(options);
  return {
    name: "read_file",
    description: "Read a UTF-8 text file from the workspace. Returns numbered lines.",
    action: "read-file",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to the workspace root." },
        maxLines: { type: "number", description: "Maximum lines to return (default 500)." },
      },
      required: ["path"],
      additionalProperties: false,
    },
    validate: (raw) => ({
      path: requireString(raw, "path"),
      maxLines: optionalNumber(raw, "maxLines", 500),
    }),
    describe: (input) => ({ path: resolveInside(config.root, input.path) }),
    execute: async (ctx, input): Promise<ToolResult> => {
      const target = resolveInside(config.root, input.path);
      const info = await stat(target).catch(() => undefined);
      if (info === undefined || !info.isFile()) {
        return { output: `No such file: ${input.path}`, isError: true };
      }
      if (info.size > config.maxFileBytes) {
        return {
          output: `File is ${info.size} bytes, above the ${config.maxFileBytes}-byte limit.`,
          isError: true,
        };
      }
      ctx.throwIfDone();
      const content = await readFile(target, "utf8");
      const lines = content.split("\n").slice(0, input.maxLines);
      const numbered = lines.map((line, index) => `${String(index + 1).padStart(5)}  ${line}`).join("\n");
      const { text, truncated } = truncate(numbered, config.maxOutputChars);
      return {
        output: text,
        metadata: { bytes: info.size, lines: lines.length, truncated },
      };
    },
  };
}

export function createWriteFileTool(options: WorkspaceOptions): ToolDefinition<{ path: string; content: string }> {
  const config = resolveOptions(options);
  return {
    name: "write_file",
    description: "Create or overwrite a UTF-8 text file in the workspace.",
    action: "write-file",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to the workspace root." },
        content: { type: "string", description: "Full file contents." },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
    validate: (raw) => ({
      path: requireString(raw, "path"),
      content: typeof raw["content"] === "string" ? raw["content"] : "",
    }),
    describe: (input) => ({ path: resolveInside(config.root, input.path) }),
    execute: async (ctx, input): Promise<ToolResult> => {
      const target = resolveInside(config.root, input.path);
      const bytes = Buffer.byteLength(input.content, "utf8");
      if (bytes > config.maxFileBytes) {
        return { output: `Refusing to write ${bytes} bytes; limit is ${config.maxFileBytes}.`, isError: true };
      }
      ctx.throwIfDone();
      await writeFile(target, input.content, "utf8");
      return { output: `Wrote ${bytes} bytes to ${input.path}`, metadata: { bytes } };
    },
  };
}

export function createListDirectoryTool(options: WorkspaceOptions): ToolDefinition<{ path: string; recursive: boolean }> {
  const config = resolveOptions(options);
  return {
    name: "list_directory",
    description: "List entries in a workspace directory.",
    action: "list-directory",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path, defaults to the workspace root." },
        recursive: { type: "boolean", description: "Walk subdirectories (bounded)." },
      },
      additionalProperties: false,
    },
    validate: (raw) => ({
      path: optionalString(raw, "path") ?? ".",
      recursive: optionalBoolean(raw, "recursive", false),
    }),
    describe: (input) => ({ path: resolveInside(config.root, input.path) }),
    execute: async (ctx, input): Promise<ToolResult> => {
      const target = resolveInside(config.root, input.path);
      const entries = await walk(ctx, target, config.root, input.recursive, 0);
      const { text, truncated } = truncate(entries.join("\n"), config.maxOutputChars);
      return { output: text.length > 0 ? text : "(empty)", metadata: { entries: entries.length, truncated } };
    },
  };
}

const IGNORED_DIRECTORIES: ReadonlySet<string> = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".cache",
  ".next",
  "coverage",
]);

async function walk(
  ctx: RequestContext,
  directory: string,
  root: string,
  recursive: boolean,
  depth: number,
): Promise<string[]> {
  if (depth > 6) return [];
  ctx.throwIfDone();
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    const absolute = join(directory, entry.name);
    const shown = relative(root, absolute) || ".";
    if (entry.isDirectory()) {
      out.push(`${shown}${sep}`);
      if (recursive && !IGNORED_DIRECTORIES.has(entry.name)) {
        out.push(...(await walk(ctx, absolute, root, recursive, depth + 1)));
      }
      continue;
    }
    out.push(shown);
  }
  return out;
}

export function createSearchTool(
  options: WorkspaceOptions,
): ToolDefinition<{ pattern: string; expression: RegExp; path: string; maxMatches: number }> {
  const config = resolveOptions(options);
  return {
    name: "search_text",
    description: "Search workspace files for a regular expression. Returns path:line:text matches.",
    action: "read-file",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "JavaScript regular expression source." },
        path: { type: "string", description: "Directory to search, defaults to the workspace root." },
        maxMatches: { type: "number", description: "Maximum matches to return (default 100)." },
      },
      required: ["pattern"],
      additionalProperties: false,
    },
    // The pattern is compiled here, not in `execute`: a malformed pattern is
    // bad input, and bad input should be rejected before the permission
    // broker is asked about a search that can never run.
    validate: (raw) => {
      const pattern = requireString(raw, "pattern");
      let expression: RegExp;
      try {
        expression = new RegExp(pattern);
      } catch (error) {
        throw new AgentError("invalid_input", "pattern is not a valid regular expression", { cause: error });
      }
      return {
        pattern,
        expression,
        path: optionalString(raw, "path") ?? ".",
        maxMatches: optionalNumber(raw, "maxMatches", 100),
      };
    },
    describe: (input) => ({ path: resolveInside(config.root, input.path) }),
    execute: async (ctx, input): Promise<ToolResult> => {
      const expression = input.expression;
      const base = resolveInside(config.root, input.path);
      const files = await walk(ctx, base, config.root, true, 0);
      const matches: string[] = [];
      for (const relativePath of files) {
        if (matches.length >= input.maxMatches) break;
        if (relativePath.endsWith(sep)) continue;
        ctx.throwIfDone();
        const absolute = join(config.root, relativePath);
        const info = await stat(absolute).catch(() => undefined);
        if (info === undefined || !info.isFile() || info.size > config.maxFileBytes) continue;
        const content = await readFile(absolute, "utf8").catch(() => undefined);
        if (content === undefined) continue;
        const lines = content.split("\n");
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index] as string;
          if (!expression.test(line)) continue;
          matches.push(`${relativePath}:${index + 1}: ${line.trim().slice(0, 200)}`);
          if (matches.length >= input.maxMatches) break;
        }
      }
      const { text, truncated } = truncate(matches.join("\n"), config.maxOutputChars);
      return {
        output: matches.length > 0 ? text : "No matches.",
        metadata: { matches: matches.length, truncated },
      };
    },
  };
}

export function createWorkspaceTools(options: WorkspaceOptions): ToolDefinition<never>[] {
  return [
    createReadFileTool(options),
    createWriteFileTool(options),
    createListDirectoryTool(options),
    createSearchTool(options),
  ] as unknown as ToolDefinition<never>[];
}
