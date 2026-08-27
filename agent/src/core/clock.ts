/**
 * Injectable clock. Tests drive time forward explicitly instead of sleeping,
 * which is what makes the retry and circuit-breaker suites deterministic.
 */

export interface Clock {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("aborted", "AbortError"));
        return;
      }
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(new DOMException("aborted", "AbortError"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
    }),
};

export class ManualClock implements Clock {
  private current: number;
  private readonly waiters: { at: number; resolve: () => void }[] = [];

  constructor(startMs = 0) {
    this.current = startMs;
  }

  now(): number {
    return this.current;
  }

  sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.waiters.push({ at: this.current + ms, resolve });
    });
  }

  /** Advance time and release every sleeper whose deadline has passed. */
  async advance(ms: number): Promise<void> {
    this.current += ms;
    const due = this.waiters.filter((w) => w.at <= this.current);
    for (const waiter of due) {
      this.waiters.splice(this.waiters.indexOf(waiter), 1);
      waiter.resolve();
    }
    // Let the released continuations run before returning.
    await Promise.resolve();
    await Promise.resolve();
  }
}
