/**
 * The human-rhythm model — the reusable core of the engine.
 *
 * These are pure functions of an `Rng` and their inputs. They carry no DOM,
 * browser, or timing side effects, which is what makes them unit-testable. Each
 * models one facet of how people actually type: burst-and-pause cadence, jitter,
 * end-of-session fatigue, sentence boundaries, and where within a word slips cluster.
 */
import { Rng } from './rng.ts';

/**
 * Jitter a base delay using a CLT-approximated normal, clamped to a floor.
 * `variability` (0..1) scales the spread; 0 = perfectly even, ~0.4 = natural.
 */
export function jitteredDelay(rng: Rng, baseMs: number, variability: number): number {
  const spread = variability * 0.8;
  return Math.max(20, baseMs * (1 + rng.normal() * spread));
}

/**
 * Length of the next typing burst before a thinking pause.
 * Poisson-like, exponentially distributed around `mean` characters (default 10).
 */
export function burstLength(rng: Rng, mean = 10): number {
  return Math.floor(-Math.log(rng.next() + 0.001) * mean) + 3;
}

/**
 * Fatigue multiplier — natural speed decay over a long session.
 * progress 0 → 1.0 (full speed); progress 1 → 1 + factor (that much slower).
 * Gentle exponential so the slowdown is imperceptible early, obvious late.
 */
export function fatigueMultiplier(progress: number, factor: number): number {
  return 1 + (factor * (Math.exp(progress * 2) - 1)) / (Math.exp(2) - 1);
}

/**
 * Smart-error-zone multiplier on the base typo rate.
 * Slips are rare at a word's edges (~0.3x) and peak mid-word (~1.8x), following a
 * bell curve — fingers are least certain mid-reach. `wordPos` is 0 (first char)→1 (last).
 */
export function smartErrorZoneMultiplier(wordPos: number): number {
  const x = (wordPos - 0.5) * 4; // scale to ±2 std devs
  return 0.3 + 1.5 * Math.exp(-0.5 * x * x);
}

/**
 * Thinking pause (ms) after a sentence-ending `.`/`?`/`!` that is followed by a
 * space — 0 otherwise. Newline-terminated sentences are handled by the caller's
 * newline logic instead.
 */
export function sentencePauseMs(rng: Rng, text: string, i: number): number {
  const ch = text[i];
  if (ch !== '.' && ch !== '?' && ch !== '!') return 0;
  const nextCh = text[i + 1];
  if (!nextCh || nextCh === '\n') return 0;
  if (nextCh === ' ' || nextCh === '\r') return 250 + rng.next() * 650;
  return 0;
}
