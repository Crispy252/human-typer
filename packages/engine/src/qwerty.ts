/**
 * QWERTY adjacency map + typo generation.
 *
 * A realistic typo is a slip to a physically-adjacent key, not a random letter.
 * This is the same map the original engine used, extracted verbatim so behaviour
 * is preserved; only the RNG source changed (seeded, for reproducibility).
 */
import { Rng } from './rng.ts';

export const ADJACENT_KEYS: Record<string, string[]> = {
  a: ['s', 'q', 'w', 'z'],
  b: ['v', 'g', 'h', 'n'],
  c: ['x', 'd', 'f', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'],
  e: ['w', 'r', 'd', 's'],
  f: ['d', 'r', 't', 'g', 'v', 'c'],
  g: ['f', 't', 'y', 'h', 'b', 'v'],
  h: ['g', 'y', 'u', 'j', 'n', 'b'],
  i: ['u', 'o', 'k', 'j'],
  j: ['h', 'u', 'i', 'k', 'm', 'n'],
  k: ['j', 'i', 'o', 'l', 'm'],
  l: ['k', 'o', 'p', ';'],
  m: ['n', 'j', 'k', ','],
  n: ['b', 'h', 'j', 'm'],
  o: ['i', 'p', 'l', 'k'],
  p: ['o', '[', 'l', ';'],
  q: ['w', 'a', 's'],
  r: ['e', 't', 'f', 'd'],
  s: ['a', 'w', 'e', 'd', 'x', 'z'],
  t: ['r', 'y', 'g', 'f'],
  u: ['y', 'i', 'j', 'h'],
  v: ['c', 'f', 'g', 'b'],
  w: ['q', 'e', 's', 'a'],
  x: ['z', 's', 'd', 'c'],
  y: ['t', 'u', 'h', 'g'],
  z: ['a', 's', 'x'],
  '0': ['9', '-', 'p', 'o'],
  '1': ['2', 'q'],
  '2': ['1', '3', 'q', 'w'],
  '3': ['2', '4', 'w', 'e'],
  '4': ['3', '5', 'e', 'r'],
  '5': ['4', '6', 'r', 't'],
  '6': ['5', '7', 't', 'y'],
  '7': ['6', '8', 'y', 'u'],
  '8': ['7', '9', 'u', 'i'],
  '9': ['8', '0', 'i', 'o'],
  ' ': ['c', 'v', 'b', 'n', 'm'],
  ',': ['m', 'k', 'l', '.'],
  '.': [',', 'l', ';', '/'],
};

/**
 * Return a plausible wrong key for `ch`, preserving case, or `null` when the
 * character has no known neighbours (in which case the caller types it correctly).
 */
export function getAdjacentKey(rng: Rng, ch: string): string | null {
  const lower = ch.toLowerCase();
  const neighbors = ADJACENT_KEYS[lower];
  if (!neighbors || neighbors.length === 0) return null;
  const pick = rng.pick(neighbors);
  return ch !== lower && ch === ch.toUpperCase() ? pick.toUpperCase() : pick;
}
