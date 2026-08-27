import { AgentError } from "../../core/errors.ts";

/** Shared HTTP helpers for the real provider adapters. */

export interface HttpCallOptions {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
}

/**
 * Maps transport and status failures onto the typed error kinds the router
 * routes on. Doing it once here is what keeps `retryable` meaningful: every
 * adapter classifies the same way instead of each inventing its own rules.
 */
export async function postJson(options: HttpCallOptions): Promise<unknown> {
  const controller = new AbortController();
  const onAbort = (): void => controller.abort(options.signal.reason);
  if (options.signal.aborted) controller.abort(options.signal.reason);
  else options.signal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort("provider timeout"), options.timeoutMs);

  let response: Response;
  try {
    response = await fetch(options.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...options.headers },
      body: JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    if (options.signal.aborted) {
      throw new AgentError("cancelled", "request cancelled", { cause: error });
    }
    if (controller.signal.aborted) {
      throw new AgentError("timeout", `provider did not respond within ${options.timeoutMs}ms`, { cause: error });
    }
    throw new AgentError("provider_unavailable", "provider unreachable", { cause: error });
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener("abort", onAbort);
  }

  const text = await response.text();
  if (!response.ok) throw classifyStatus(response, text);

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new AgentError("provider_rejected", "provider returned a non-JSON body", { cause: error });
  }
}

function classifyStatus(response: Response, body: string): AgentError {
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterMs =
    retryAfterHeader === null ? undefined : Number.parseFloat(retryAfterHeader) * 1000;
  // Bodies can echo the prompt back; keep only a short, bounded excerpt.
  const excerpt = body.slice(0, 300);

  if (response.status === 429) {
    return new AgentError("rate_limited", "provider rate limited the request", {
      retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
      details: { status: response.status },
    });
  }
  if (response.status >= 500) {
    return new AgentError("provider_unavailable", `provider error ${response.status}`, {
      details: { status: response.status, excerpt },
    });
  }
  if (response.status === 401 || response.status === 403) {
    return new AgentError("provider_rejected", "provider rejected the credentials", {
      details: { status: response.status },
    });
  }
  if (response.status === 400 || response.status === 422) {
    return new AgentError("invalid_input", "provider rejected the request shape", {
      details: { status: response.status, excerpt },
    });
  }
  return new AgentError("provider_rejected", `unexpected provider status ${response.status}`, {
    details: { status: response.status, excerpt },
  });
}

export function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function readRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Tool arguments arrive as a JSON string from some providers, an object from others. */
export function parseArguments(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    if (value.trim().length === 0) return {};
    try {
      return readRecord(JSON.parse(value));
    } catch {
      throw new AgentError("provider_rejected", "tool arguments were not valid JSON");
    }
  }
  return readRecord(value);
}
