import type { RequestContext } from "../core/context.ts";
import { AgentError } from "../core/errors.ts";
import {
  clampToCeiling,
  DEFAULT_PERMISSION_LEVEL,
  MUTATING_ACTIONS,
  type GrantScope,
  type PermissionLevel,
  type PermissionOutcome,
  type PermissionRequest,
  type ToolAction,
} from "./model.ts";
import { builtinDenyFor, ruleMatches, type PermissionRule } from "./rules.ts";

/**
 * Asked when a request resolves to `ask`. Returning `undefined` means the
 * caller could not be reached, which is treated as a denial: a prompt nobody
 * answered must not become an approval.
 */
export type PermissionPrompter = (
  ctx: RequestContext,
  request: PermissionRequest,
  reason: string,
) => Promise<{ approved: boolean; scope: GrantScope } | undefined>;

export interface AuditEntry {
  readonly at: number;
  readonly request: PermissionRequest;
  readonly outcome: PermissionOutcome;
  readonly prompted: boolean;
}

export interface PermissionBrokerOptions {
  /** Per-action baseline when no rule matches. */
  readonly defaults?: Partial<Record<ToolAction, PermissionLevel>>;
  /** User- or project-supplied rules, evaluated after the built-in deny list. */
  readonly rules?: readonly PermissionRule[];
  /** Administrator ceiling; can only lower an effective level. */
  readonly ceiling?: PermissionLevel;
  readonly prompter?: PermissionPrompter;
  /** Keep at most this many audit entries in memory. */
  readonly auditCapacity?: number;
}

function grantKey(request: PermissionRequest): string {
  return [request.action, request.tool, request.command ?? "", request.path ?? "", request.url ?? ""].join(" ");
}

export class PermissionBroker {
  private readonly defaults: Partial<Record<ToolAction, PermissionLevel>>;
  private readonly rules: readonly PermissionRule[];
  private readonly ceiling: PermissionLevel | undefined;
  private readonly prompter: PermissionPrompter | undefined;
  private readonly auditCapacity: number;

  private readonly sessionGrants = new Set<string>();
  private readonly persistentGrants = new Set<string>();
  private readonly auditLog: AuditEntry[] = [];

  constructor(options: PermissionBrokerOptions = {}) {
    this.defaults = options.defaults ?? {};
    this.rules = options.rules ?? [];
    this.ceiling = options.ceiling;
    this.prompter = options.prompter;
    this.auditCapacity = options.auditCapacity ?? 500;
  }

  /**
   * Static evaluation: rules and defaults only, no prompting. Exposed so a UI
   * can preview what a request would do without side effects.
   */
  evaluate(request: PermissionRequest): PermissionOutcome {
    // 1. Built-in denials are absolute and are checked before anything else.
    const builtin = builtinDenyFor(request);
    if (builtin !== undefined) {
      return { decision: "deny", reason: builtin.note, rule: builtin.id };
    }

    // 2. Configured rules. Deny wins over allow regardless of order, so a
    //    later broad allow cannot re-open something an earlier rule closed.
    let allowRule: PermissionRule | undefined;
    let askRule: PermissionRule | undefined;
    for (const rule of this.rules) {
      if (!ruleMatches(rule, request)) continue;
      if (rule.level === "never") {
        return { decision: "deny", reason: rule.note ?? "denied by rule", rule: rule.id };
      }
      if (rule.level === "always" && allowRule === undefined) allowRule = rule;
      if (rule.level === "ask" && askRule === undefined) askRule = rule;
    }

    // 3. An `ask` rule beats an `always` rule: the more cautious match wins.
    const matched = askRule ?? allowRule;
    const base = matched?.level ?? this.defaults[request.action] ?? DEFAULT_PERMISSION_LEVEL;
    const effective = clampToCeiling(base, this.ceiling);
    const ruleId = matched?.id ?? `default:${request.action}`;

    if (effective === "never") {
      return { decision: "deny", reason: "denied by policy", rule: ruleId };
    }
    if (effective === "always") {
      return { decision: "allow", reason: matched?.note ?? "allowed by policy", rule: ruleId };
    }
    return { decision: "ask", reason: "needs confirmation", rule: ruleId };
  }

  /**
   * Full check, including standing grants and prompting. Throws
   * `AgentError("permission_denied")` when the request may not proceed.
   */
  async check(ctx: RequestContext, request: PermissionRequest): Promise<PermissionOutcome> {
    const key = grantKey(request);
    let outcome = this.evaluate(request);
    let prompted = false;

    if (outcome.decision === "ask") {
      if (this.persistentGrants.has(key)) {
        outcome = { decision: "allow", reason: "standing grant", rule: "grant:persistent" };
      } else if (this.sessionGrants.has(key)) {
        outcome = { decision: "allow", reason: "session grant", rule: "grant:session" };
      } else if (this.prompter === undefined) {
        // No way to ask means no approval. Fail closed.
        outcome = { decision: "deny", reason: "confirmation required but unavailable", rule: outcome.rule };
      } else {
        prompted = true;
        const answer = await this.prompter(ctx, request, outcome.reason);
        if (answer === undefined || !answer.approved) {
          outcome = { decision: "deny", reason: "declined", rule: outcome.rule };
        } else {
          if (answer.scope === "session") this.sessionGrants.add(key);
          if (answer.scope === "persistent") this.persistentGrants.add(key);
          outcome = { decision: "allow", reason: `approved (${answer.scope})`, rule: outcome.rule };
        }
      }
    }

    this.record(ctx, { at: ctx.clock.now(), request, outcome, prompted });

    ctx.emit(outcome.decision === "deny" ? "warn" : "debug", `permission.${outcome.decision}`, {
      action: request.action,
      tool: request.tool,
      rule: outcome.rule,
      reason: outcome.reason,
      mutating: MUTATING_ACTIONS.has(request.action),
    });
    ctx.count("permission.decision", 1, { decision: outcome.decision, action: request.action });

    if (outcome.decision === "deny") {
      throw new AgentError("permission_denied", `${request.tool}: ${outcome.reason}`, {
        details: { action: request.action, rule: outcome.rule },
      });
    }
    return outcome;
  }

  /** Drop session grants; persistent grants survive. */
  endSession(): void {
    this.sessionGrants.clear();
  }

  audit(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(ctx: RequestContext, entry: AuditEntry): void {
    this.auditLog.push(entry);
    if (this.auditLog.length > this.auditCapacity) {
      this.auditLog.shift();
      ctx.count("permission.audit.dropped", 1, {});
    }
  }
}
