import type { PermissionLevel, PermissionRequest, ToolAction } from "./model.ts";

/**
 * Rule matching.
 *
 * User-authored rules are globs (`*` within a segment, `**` across segments)
 * rather than raw regexes: someone writing an allow-list should not be able to
 * write a catastrophically backtracking pattern, and a mistyped glob fails
 * closed instead of matching everything.
 *
 * The built-in denials below are authored here, so they use regexes — a glob
 * cannot express "an `rm` that has a recursive flag *and* targets a system
 * directory", and splitting that into two separate concerns is what makes the
 * guard catch real command lines instead of one exact spelling.
 */

export interface PermissionRule {
  readonly id: string;
  readonly level: PermissionLevel;
  /** Match any of these actions; omit for all actions. */
  readonly actions?: readonly ToolAction[];
  readonly tool?: string;
  readonly command?: string;
  readonly path?: string;
  readonly url?: string;
  readonly note?: string;
}

export function globToRegExp(glob: string): RegExp {
  let source = "^";
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i] as string;
    if (char === "*") {
      if (glob[i + 1] === "*") {
        source += ".*";
        i += 1;
        // `**/` should also match zero segments.
        if (glob[i + 1] === "/") i += 1;
      } else {
        source += "[^/]*";
      }
      continue;
    }
    if (char === "?") {
      source += "[^/]";
      continue;
    }
    source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`${source}$`);
}

function matchesGlob(glob: string | undefined, value: string | undefined): boolean {
  if (glob === undefined) return true; // unconstrained field
  if (value === undefined) return false; // rule constrains a field the request lacks
  return globToRegExp(glob).test(value);
}

export function ruleMatches(rule: PermissionRule, request: PermissionRequest): boolean {
  if (rule.actions !== undefined && !rule.actions.includes(request.action)) return false;
  return (
    matchesGlob(rule.tool, request.tool) &&
    matchesGlob(rule.command, request.command) &&
    matchesGlob(rule.path, request.path) &&
    matchesGlob(rule.url, request.url)
  );
}

/* ------------------------------------------------------------------ *
 * Built-in denials.
 *
 * These are a guard against the common accident, not a security
 * boundary: a determined model can obfuscate a command line. They are
 * checked before every other rule and cannot be overridden.
 * ------------------------------------------------------------------ */

export interface BuiltinDeny {
  readonly id: string;
  readonly note: string;
  readonly actions: readonly ToolAction[];
  matches(request: PermissionRequest): boolean;
}

/** An `rm` whose flags include a recursive flag. */
const RECURSIVE_RM = /\brm\b(?=(?:\s+-\S+)*\s+-\S*[rR])/;

/** A path argument at, or one level below, the filesystem root. */
const SYSTEM_TARGET =
  /\s\/(?:\s|$)|\s\/(?:usr|etc|var|bin|sbin|lib|lib64|boot|dev|sys|proc|home|root|opt|Users|Applications|System|Library)(?:\/|\s|$)/;

const commandOf = (request: PermissionRequest): string => request.command ?? "";
const pathOf = (request: PermissionRequest): string => request.path ?? "";

const COMMAND_ACTIONS: readonly ToolAction[] = ["run-command"];
const FILE_ACTIONS: readonly ToolAction[] = ["read-file", "write-file", "delete-file"];

export const DESTRUCTIVE_COMMAND_RULES: readonly BuiltinDeny[] = [
  {
    id: "builtin:rm-rf-root",
    note: "recursive delete targeting a system directory",
    actions: COMMAND_ACTIONS,
    matches: (request) => RECURSIVE_RM.test(commandOf(request)) && SYSTEM_TARGET.test(commandOf(request)),
  },
  {
    id: "builtin:mkfs",
    note: "filesystem format",
    actions: COMMAND_ACTIONS,
    matches: (request) => /\bmkfs(?:\.\w+)?\b/.test(commandOf(request)),
  },
  {
    id: "builtin:dd-disk",
    note: "raw device write",
    actions: COMMAND_ACTIONS,
    matches: (request) => /\bdd\b[^;&|]*\bof=\/dev\//.test(commandOf(request)),
  },
  {
    id: "builtin:fork-bomb",
    note: "fork bomb",
    actions: COMMAND_ACTIONS,
    matches: (request) => /:\s*\(\s*\)\s*\{[^}]*\|[^}]*&/.test(commandOf(request)),
  },
  {
    id: "builtin:force-push",
    note: "force push rewrites published history",
    actions: COMMAND_ACTIONS,
    matches: (request) => /\bgit\s+push\b[^;&|]*(?:--force(?!-with-lease)|\s-f(?:\s|$))/.test(commandOf(request)),
  },
  {
    id: "builtin:remote-script-to-shell",
    note: "remote script piped into a shell",
    actions: COMMAND_ACTIONS,
    matches: (request) => /\b(?:curl|wget)\b[^;&|]*\|\s*(?:sudo\s+)?(?:ba|z|k|)sh\b/.test(commandOf(request)),
  },
  {
    id: "builtin:chmod-world-writable-root",
    note: "world-writable permissions on a system path",
    actions: COMMAND_ACTIONS,
    matches: (request) => /\bchmod\b[^;&|]*\s777\b/.test(commandOf(request)) && SYSTEM_TARGET.test(commandOf(request)),
  },
];

export const SENSITIVE_PATH_RULES: readonly BuiltinDeny[] = [
  {
    id: "builtin:ssh-keys",
    note: "ssh key material",
    actions: FILE_ACTIONS,
    matches: (request) => /(?:^|\/)\.ssh\//.test(pathOf(request)),
  },
  {
    id: "builtin:cloud-credentials",
    note: "cloud credentials",
    actions: FILE_ACTIONS,
    matches: (request) => /(?:^|\/)\.aws\/credentials$/.test(pathOf(request)),
  },
  {
    id: "builtin:netrc",
    note: "stored logins",
    actions: FILE_ACTIONS,
    matches: (request) => /(?:^|\/)\.netrc$/.test(pathOf(request)),
  },
  {
    id: "builtin:gnupg",
    note: "gpg key material",
    actions: FILE_ACTIONS,
    matches: (request) => /(?:^|\/)\.gnupg\//.test(pathOf(request)),
  },
];

export const BUILTIN_DENY_RULES: readonly BuiltinDeny[] = [
  ...DESTRUCTIVE_COMMAND_RULES,
  ...SENSITIVE_PATH_RULES,
];

export function builtinDenyFor(request: PermissionRequest): BuiltinDeny | undefined {
  return BUILTIN_DENY_RULES.find(
    (rule) => rule.actions.includes(request.action) && rule.matches(request),
  );
}
