/**
 * Deterministic pseudo-random number generator.
 *
 * The original typing engine used `Math.random()` everywhere, which makes runs
 * impossible to reproduce. For a testing tool that is the wrong default: CI needs
 * the *same* human-like sequence every run so failures are debuggable. `Rng` is a
 * small seedable PRNG (mulberry32) so a given seed always yields the same plan.
 */

/** FNV-1a hash — turns a string seed into a 32-bit unsigned integer. */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Resolve a user-supplied seed (number, string, or undefined) to a 32-bit uint. */
export function resolveSeed(seed?: number | string): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  if (typeof seed === 'string') return hashSeed(seed);
  // No seed given: derive one from the clock so behaviour stays "random" by default.
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export class Rng {
  private a: number;

  constructor(seed: number) {
    this.a = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.a |= 0;
    this.a = (this.a + 0x6d2b79f5) | 0;
    let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Pick a uniformly random element from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /**
   * Approximate a standard normal via the central limit theorem on three
   * uniform samples — the same shape the original engine used for keystroke
   * jitter, now driven by the seeded stream. Mean 0, roughly unit-ish spread.
   */
  normal(): number {
    return (this.next() + this.next() + this.next() - 1.5) / 1.5;
  }
}
