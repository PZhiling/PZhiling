import { AgentError } from "../../core/errors.ts";
import { optionalNumber, requireString, type ToolDefinition, type ToolResult } from "../registry.ts";

/**
 * HTTP fetch tool.
 *
 * Outbound requests get their own guards, separate from the permission rules:
 * only `http`/`https`, no credentials in the URL, an optional host allow-list,
 * and no redirect following. Following redirects would let an allowed host
 * bounce the agent to a denied one, which is the standard way a host
 * allow-list is defeated.
 */

export interface FetchToolOptions {
  readonly allowedHosts?: readonly string[];
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly userAgent?: string;
}

export function createFetchTool(options: FetchToolOptions = {}): ToolDefinition<{ url: string; maxChars: number }> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const maxBytes = options.maxBytes ?? 512 * 1024;
  const allowedHosts = options.allowedHosts;

  const checkUrl = (raw: string): URL => {
    let url: URL;
    try {
      url = new URL(raw);
    } catch (error) {
      throw new AgentError("invalid_input", "not a valid absolute URL", { cause: error });
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new AgentError("permission_denied", `unsupported scheme: ${url.protocol}`);
    }
    if (url.username.length > 0 || url.password.length > 0) {
      throw new AgentError("permission_denied", "credentials in a URL are not allowed");
    }
    if (allowedHosts !== undefined && !allowedHosts.includes(url.hostname)) {
      throw new AgentError("permission_denied", `host not in the allow-list: ${url.hostname}`);
    }
    return url;
  };

  return {
    name: "fetch_url",
    description: "Fetch a URL over HTTP(S) and return the response body as text.",
    action: "network-fetch",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Absolute http(s) URL." },
        maxChars: { type: "number", description: "Maximum characters to return (default 20000)." },
      },
      required: ["url"],
      additionalProperties: false,
    },
    validate: (raw) => {
      const url = requireString(raw, "url");
      checkUrl(url);
      return { url, maxChars: optionalNumber(raw, "maxChars", 20_000) };
    },
    describe: (input) => ({ url: input.url }),
    execute: async (ctx, input): Promise<ToolResult> => {
      const url = checkUrl(input.url);
      ctx.throwIfDone();

      const controller = new AbortController();
      const onAbort = (): void => controller.abort(ctx.signal.reason);
      ctx.signal.addEventListener("abort", onAbort, { once: true });
      const budget = Math.min(timeoutMs, Math.max(1_000, ctx.remainingMs()));
      const timer = setTimeout(() => controller.abort("fetch timeout"), budget);

      try {
        const response = await fetch(url, {
          redirect: "manual",
          signal: controller.signal,
          headers: { "user-agent": options.userAgent ?? "pzhiling-agent/0.1" },
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location") ?? "(none)";
          return {
            output: `Redirect ${response.status} to ${location}. Redirects are not followed; fetch the target explicitly if it is allowed.`,
            isError: true,
            metadata: { status: response.status },
          };
        }

        const buffer = await response.arrayBuffer();
        const bytes = buffer.byteLength;
        const text = new TextDecoder().decode(buffer.slice(0, maxBytes));
        const body = text.length > input.maxChars ? `${text.slice(0, input.maxChars)}\n... [truncated]` : text;
        return {
          output: `HTTP ${response.status} ${response.headers.get("content-type") ?? ""}\n\n${body}`,
          isError: !response.ok,
          metadata: { status: response.status, bytes },
        };
      } catch (error) {
        if (ctx.signal.aborted) throw new AgentError("cancelled", "fetch cancelled", { cause: error });
        if (controller.signal.aborted) {
          return { output: `Request timed out after ${budget}ms.`, isError: true };
        }
        return { output: `Request failed: ${(error as Error).message}`, isError: true };
      } finally {
        clearTimeout(timer);
        ctx.signal.removeEventListener("abort", onAbort);
      }
    },
  };
}
