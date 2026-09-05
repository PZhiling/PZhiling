/**
 * Permission model.
 *
 * The design this is based on had three states (`always` / `ask` / `never`)
 * over five coarse actions, clamped by an admin ceiling. That ceiling idea is
 * good and is kept. What is added here:
 *
 *  - decisions match on *patterns* (tool name, command, path), not just the
 *    action class, so "always allow `git status`" does not also allow `rm`;
 *  - grants carry a scope (`once` / `session` / `persistent`), so approving a
 *    command in one turn does not silently become a standing grant;
 *  - deny always wins over allow, whatever the rule order;
 *  - a built-in deny list covers destructive commands even at `always`.
 */

export const PERMISSION_LEVELS = ["never", "ask", "always"] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const PERMISSION_RANK: Readonly<Record<PermissionLevel, number>> = {
  never: 0,
  ask: 1,
  always: 2,
};

export const DEFAULT_PERMISSION_LEVEL: PermissionLevel = "ask";

export const TOOL_ACTIONS = [
  "read-file",
  "list-directory",
  "write-file",
  "delete-file",
  "run-command",
  "network-fetch",
  "mcp-call",
] as const;
export type ToolAction = (typeof TOOL_ACTIONS)[number];

/** Actions that change something outside the process. */
export const MUTATING_ACTIONS: ReadonlySet<ToolAction> = new Set<ToolAction>([
  "write-file",
  "delete-file",
  "run-command",
  "network-fetch",
  "mcp-call",
]);

export type GrantScope = "once" | "session" | "persistent";

export interface PermissionRequest {
  readonly action: ToolAction;
  readonly tool: string;
  /** Shell command line, for `run-command`. */
  readonly command?: string;
  /** Absolute path, for file actions. */
  readonly path?: string;
  /** Target URL, for `network-fetch`. */
  readonly url?: string;
}

export type PermissionOutcome =
  | { readonly decision: "allow"; readonly reason: string; readonly rule: string }
  | { readonly decision: "ask"; readonly reason: string; readonly rule: string }
  | { readonly decision: "deny"; readonly reason: string; readonly rule: string };

export function isPermissionLevel(value: unknown): value is PermissionLevel {
  return typeof value === "string" && (PERMISSION_LEVELS as readonly string[]).includes(value);
}

export function normalizeLevel(value: unknown): PermissionLevel {
  return isPermissionLevel(value) ? value : DEFAULT_PERMISSION_LEVEL;
}

/**
 * Clamp a user's choice to an administrator ceiling. A ceiling can only ever
 * lower the effective level.
 */
export function clampToCeiling(choice: PermissionLevel, ceiling?: PermissionLevel): PermissionLevel {
  if (ceiling === undefined) return choice;
  return PERMISSION_RANK[choice] <= PERMISSION_RANK[ceiling] ? choice : ceiling;
}
