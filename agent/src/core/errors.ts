/**
 * Typed error registry.
 *
 * Every failure that crosses a layer boundary is one of these. The `kind`
 * drives retry policy, the `retryable` flag is computed once at the throw
 * site instead of being re-guessed by string matching further up the stack.
 */

export const ERROR_KINDS = [
  "cancelled",
  "timeout",
  "rate_limited",
  "provider_unavailable",
  "provider_rejected",
  "budget_exceeded",
  "permission_denied",
  "invalid_input",
  "not_found",
  "integrity",
  "internal",
] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];

/** Kinds that a retry could plausibly fix. Everything else fails fast. */
const RETRYABLE: ReadonlySet<ErrorKind> = new Set<ErrorKind>([
  "timeout",
  "rate_limited",
  "provider_unavailable",
]);

export interface AgentErrorOptions {
  readonly cause?: unknown;
  /** Suggested wait before the next attempt, when the peer told us one. */
  readonly retryAfterMs?: number;
  /** Small, non-secret facts useful in a log line. */
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

export class AgentError extends Error {
  readonly kind: ErrorKind;
  readonly retryable: boolean;
  readonly retryAfterMs: number | undefined;
  readonly details: Readonly<Record<string, string | number | boolean>>;

  constructor(kind: ErrorKind, message: string, options: AgentErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AgentError";
    this.kind = kind;
    this.retryable = RETRYABLE.has(kind);
    this.retryAfterMs = options.retryAfterMs;
    this.details = options.details ?? {};
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      kind: this.kind,
      message: this.message,
      retryable: this.retryable,
      retryAfterMs: this.retryAfterMs,
      details: this.details,
    };
  }
}

export function isAgentError(value: unknown): value is AgentError {
  return value instanceof AgentError;
}

export function errorKindOf(value: unknown): ErrorKind {
  if (isAgentError(value)) return value.kind;
  if (value instanceof Error && value.name === "AbortError") return "cancelled";
  return "internal";
}

export function isRetryable(value: unknown): boolean {
  return isAgentError(value) ? value.retryable : false;
}

/** Never let an arbitrary throw escape as `[object Object]`. */
export function toAgentError(value: unknown, fallbackMessage = "unexpected failure"): AgentError {
  if (isAgentError(value)) return value;
  if (value instanceof Error) {
    return new AgentError(errorKindOf(value), value.message || fallbackMessage, { cause: value });
  }
  return new AgentError("internal", fallbackMessage, { cause: value });
}
