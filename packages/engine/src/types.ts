/** Public types for the typing engine. */

export interface TypingConfig {
  /**
   * Target total duration in milliseconds. When set, the plan is normalised so
   * its delays sum to exactly this value. When omitted, the plan runs at the
   * natural cadence implied by `wpm`.
   */
  durationMs?: number;

  /** Words-per-minute target used when `durationMs` is not given (1 word = 5 chars). Default 65. */
  wpm?: number;

  /** Inter-keystroke delay spread, 0..1. 0 = robotic, ~0.4 = natural, 1 = erratic. Default 0.4. */
  variability?: number;

  /** Per-character probability of an adjacent-key typo, 0..1. Default 0.03. */
  typoRate?: number;

  /**
   * Session fatigue. `true` uses the default 0.35 (35% slower by the end); a
   * number sets the slowdown fraction directly; `false`/omitted disables it.
   */
  fatigue?: boolean | number;

  /** Cluster typos toward the middle of words (bell curve) instead of uniformly. Default false. */
  smartErrorZones?: boolean;

  /** Add reading pauses after newlines and occasional in-burst micro-hesitations. Default false. */
  stealth?: boolean;

  /** Pause after sentence-ending punctuation. Default true. */
  sentencePauses?: boolean;

  /** Deterministic seed (number or string). Omit for a clock-derived random seed. */
  seed?: number | string;

  /** Mean characters per burst before a thinking pause. Default 10. */
  burstMean?: number;
}

export type TypingEventKind = 'key' | 'enter' | 'backspace' | 'pause';

export interface TypingEvent {
  kind: TypingEventKind;
  /** Milliseconds to wait BEFORE performing this event. */
  delayMs: number;
  /** The character to emit — present only for `kind: 'key'` (may be a wrong key mid-typo). */
  char?: string;
  /** Human-readable tag describing why this event exists (e.g. 'typo', 'burst-pause'). */
  reason?: string;
}

export interface TypingPlan {
  /** The ordered event stream. Feed it to any executor: sleep(delayMs), then act. */
  events: TypingEvent[];
  /** Sum of every `delayMs` — the planned wall-clock duration in ms. */
  totalMs: number;
  /** The resolved numeric seed actually used (surfaced so random runs are reproducible). */
  seed: number;
  /** Number of source characters the plan represents. */
  length: number;
}
