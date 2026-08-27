import { AgentError } from "../core/errors.ts";
import { EMPTY_USAGE, type ProviderCost, type Usage } from "./provider.ts";

/**
 * Usage ledger.
 *
 * The design this is based on recorded per-provider request and token totals
 * and displayed them. This version also prices them and enforces a ceiling:
 * a runaway loop should stop by itself, not be discovered on next month's
 * invoice. The figures remain local activity records, not an invoice.
 */

export interface ProviderUsage extends Usage {
  readonly requests: number;
  readonly failures: number;
  readonly estimatedCostUsd: number;
  readonly lastUsedAt: number | undefined;
}

export interface UsageSnapshot {
  readonly schemaVersion: 1;
  readonly providers: Readonly<Record<string, ProviderUsage>>;
  readonly totalEstimatedCostUsd: number;
}

function emptyProviderUsage(): ProviderUsage {
  return { ...EMPTY_USAGE, requests: 0, failures: 0, estimatedCostUsd: 0, lastUsedAt: undefined };
}

export function priceOf(usage: Usage, cost: ProviderCost): number {
  const billedInput = usage.inputTokens + usage.cacheWriteTokens;
  // Cache reads are billed at a fraction of input almost everywhere; 10% is a
  // deliberately conservative stand-in rather than a per-provider table.
  const cacheRead = usage.cacheReadTokens * 0.1;
  return (
    ((billedInput + cacheRead) * cost.inputPerMillion) / 1_000_000 +
    (usage.outputTokens * cost.outputPerMillion) / 1_000_000
  );
}

export interface UsageLedgerOptions {
  /** Hard ceiling in USD for this ledger's lifetime. */
  readonly budgetUsd?: number;
  /** Emit a warning once spend crosses this fraction of the budget. */
  readonly warnAtFraction?: number;
}

export class UsageLedger {
  private readonly providers = new Map<string, ProviderUsage>();
  private total = 0;
  private warned = false;

  private readonly options: UsageLedgerOptions;

  constructor(options: UsageLedgerOptions = {}) {
    this.options = options;
  }

  record(providerId: string, usage: Usage, cost: ProviderCost, at: number): ProviderUsage {
    const previous = this.providers.get(providerId) ?? emptyProviderUsage();
    const price = priceOf(usage, cost);
    const next: ProviderUsage = {
      requests: previous.requests + 1,
      failures: previous.failures,
      inputTokens: previous.inputTokens + usage.inputTokens,
      outputTokens: previous.outputTokens + usage.outputTokens,
      cacheReadTokens: previous.cacheReadTokens + usage.cacheReadTokens,
      cacheWriteTokens: previous.cacheWriteTokens + usage.cacheWriteTokens,
      estimatedCostUsd: previous.estimatedCostUsd + price,
      lastUsedAt: at,
    };
    this.providers.set(providerId, next);
    this.total += price;
    return next;
  }

  recordFailure(providerId: string, at: number): void {
    const previous = this.providers.get(providerId) ?? emptyProviderUsage();
    this.providers.set(providerId, { ...previous, failures: previous.failures + 1, lastUsedAt: at });
  }

  /** Throws `budget_exceeded` when the ceiling has already been reached. */
  assertWithinBudget(): void {
    const budget = this.options.budgetUsd;
    if (budget === undefined) return;
    if (this.total >= budget) {
      throw new AgentError("budget_exceeded", `usage budget of $${budget.toFixed(2)} reached`, {
        details: { spentUsd: Number(this.total.toFixed(6)), budgetUsd: budget },
      });
    }
  }

  /** True the first time spend crosses the warning threshold. */
  shouldWarn(): boolean {
    const budget = this.options.budgetUsd;
    if (budget === undefined || this.warned) return false;
    const fraction = this.options.warnAtFraction ?? 0.8;
    if (this.total >= budget * fraction) {
      this.warned = true;
      return true;
    }
    return false;
  }

  spentUsd(): number {
    return this.total;
  }

  snapshot(): UsageSnapshot {
    return {
      schemaVersion: 1,
      providers: Object.fromEntries(this.providers),
      totalEstimatedCostUsd: this.total,
    };
  }
}
