/**
 * Redaction runs on the way *out* — every telemetry event and every log line
 * passes through it before it reaches a sink. The studied design scrubbed at
 * the reporting client; doing it at the sink boundary instead means a new sink
 * cannot accidentally bypass it.
 */

export const PRIVACY_MODES = ["off", "balanced", "strict"] as const;
export type PrivacyMode = (typeof PRIVACY_MODES)[number];

export interface RedactionRule {
  readonly name: string;
  readonly pattern: RegExp;
  /** Lowest mode at which the rule is active. */
  readonly from: PrivacyMode;
}

const MODE_RANK: Readonly<Record<PrivacyMode, number>> = { off: 0, balanced: 1, strict: 2 };

/**
 * Ordered most-specific first: a bearer token should be reported as a bearer
 * token, not as a generic long-random-string.
 */
export const DEFAULT_RULES: readonly RedactionRule[] = [
  { name: "anthropic_key", pattern: /\bsk-ant-[A-Za-z0-9_-]{16,}/g, from: "balanced" },
  { name: "openai_key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, from: "balanced" },
  { name: "google_key", pattern: /\bAIza[0-9A-Za-z_-]{30,}/g, from: "balanced" },
  { name: "github_token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}/g, from: "balanced" },
  { name: "slack_token", pattern: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g, from: "balanced" },
  { name: "aws_access_key", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, from: "balanced" },
  { name: "bearer", pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi, from: "balanced" },
  { name: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, from: "balanced" },
  { name: "private_key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, from: "balanced" },
  { name: "url_credentials", pattern: /\b([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s:@]+@/gi, from: "balanced" },
  { name: "email", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, from: "strict" },
  { name: "home_path", pattern: /(?:\/(?:home|Users)\/)[^/\s"']+/g, from: "strict" },
  { name: "ipv4", pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, from: "strict" },
];

export interface Redactor {
  readonly mode: PrivacyMode;
  text(value: string): string;
  value<T>(value: T): T;
}

const MAX_DEPTH = 8;

export function createRedactor(mode: PrivacyMode, rules: readonly RedactionRule[] = DEFAULT_RULES): Redactor {
  const active = rules.filter((rule) => MODE_RANK[mode] >= MODE_RANK[rule.from]);

  const text = (value: string): string => {
    if (active.length === 0) return value;
    let out = value;
    for (const rule of active) {
      // Rules are module-level and carry /g state; reset before every use.
      rule.pattern.lastIndex = 0;
      out = out.replace(rule.pattern, (_match, ...groups) => {
        const prefix = typeof groups[0] === "string" ? groups[0] : "";
        return `${prefix}[redacted:${rule.name}]`;
      });
    }
    return out;
  };

  const walk = (value: unknown, depth: number): unknown => {
    if (depth > MAX_DEPTH) return "[redacted:depth]";
    if (typeof value === "string") return text(value);
    if (Array.isArray(value)) return value.map((item) => walk(item, depth + 1));
    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? "[redacted:key]" : walk(item, depth + 1);
      }
      return out;
    }
    return value;
  };

  return {
    mode,
    text,
    value: <T,>(value: T): T => walk(value, 0) as T,
  };
}

/** Field names whose value is dropped wholesale, whatever it looks like. */
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "password",
  "passwd",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "client_secret",
  "set-cookie",
]);
