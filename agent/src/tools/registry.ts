import type { RequestContext } from "../core/context.ts";
import { AgentError } from "../core/errors.ts";
import type { PermissionRequest, ToolAction } from "../permission/model.ts";
import type { ToolSchema } from "../router/provider.ts";

/**
 * Tool registry.
 *
 * Each tool declares the permission action it performs and derives the concrete
 * permission request from its own arguments. The loop therefore never needs to
 * know what a tool does in order to police it — adding a tool cannot forget to
 * add a permission check, because the check is driven off the declaration.
 */

export interface ToolResult {
  readonly output: string;
  /** Set when the tool failed in a way the model should see and can act on. */
  readonly isError?: boolean;
  /** Non-secret facts recorded on the telemetry event. */
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface ToolDefinition<Input = Record<string, unknown>> {
  readonly name: string;
  readonly description: string;
  readonly action: ToolAction;
  /** JSON Schema for the arguments, sent to the provider verbatim. */
  readonly parameters: Record<string, unknown>;
  /** Reject malformed input before any permission check or side effect. */
  validate(raw: Record<string, unknown>): Input;
  /** Describe this specific invocation for the permission broker. */
  describe(input: Input): Omit<PermissionRequest, "action" | "tool">;
  execute(ctx: RequestContext, input: Input): Promise<ToolResult>;
  /** Wall-clock budget for one call. */
  readonly timeoutMs?: number;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<never>>();

  register<Input>(tool: ToolDefinition<Input>): this {
    if (this.tools.has(tool.name)) {
      throw new AgentError("invalid_input", `tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool as unknown as ToolDefinition<never>);
    return this;
  }

  registerAll(tools: readonly ToolDefinition<never>[]): this {
    for (const tool of tools) this.register(tool);
    return this;
  }

  get(name: string): ToolDefinition<never> {
    const tool = this.tools.get(name);
    if (tool === undefined) {
      throw new AgentError("not_found", `unknown tool: ${name}`, {
        details: { available: [...this.tools.keys()].join(",") },
      });
    }
    return tool;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  /** The schemas to advertise to the provider. */
  schemas(): ToolSchema[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
}

/* ---------------------------------------------------------------------- *
 * Small validation helpers.
 *
 * A hand-rolled set rather than a schema library: the whole runtime stays
 * dependency-free, and the checks a tool actually needs are few.
 * ---------------------------------------------------------------------- */

export function requireString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new AgentError("invalid_input", `\`${key}\` must be a non-empty string`);
  }
  return value;
}

export function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new AgentError("invalid_input", `\`${key}\` must be a string`);
  return value;
}

export function optionalNumber(raw: Record<string, unknown>, key: string, fallback: number): number {
  const value = raw[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AgentError("invalid_input", `\`${key}\` must be a number`);
  }
  return value;
}

export function optionalBoolean(raw: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = raw[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new AgentError("invalid_input", `\`${key}\` must be a boolean`);
  return value;
}
