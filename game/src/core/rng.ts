/**
 * Deterministic PRNG (mulberry32).
 *
 * The whole simulation draws randomness from one seeded stream so that a run
 * is reproducible from its seed. That is what makes the netcode addition later
 * cheap: two machines stepping the same inputs from the same seed stay in sync.
 */
export class Rng {
  private s: number;

  constructor(seed = 0x9e3779b9) {
    this.s = seed >>> 0;
  }

  /** Raw float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  int(lo: number, hi: number): number {
    return Math.floor(this.range(lo, hi + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length) % arr.length];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Snapshot/restore so replays and rollback can rewind the stream. */
  getState(): number {
    return this.s;
  }

  setState(s: number): void {
    this.s = s >>> 0;
  }
}

/** A separate, unseeded stream for cosmetic-only effects (particles, sparks). */
export const fxRng = new Rng((Math.random() * 0xffffffff) >>> 0);
