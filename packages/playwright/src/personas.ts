/**
 * Typing personas — named `@cadence/engine` configs modelling distinct typists.
 *
 * Spreading a persona into `humanType` options gives a repeatable, recognisable
 * cadence. Override any field per call (e.g. `{ ...personas.fastDev, seed }`).
 */
import type { TypingConfig } from '@cadence/engine';

export type PersonaName = 'fastDev' | 'steady' | 'huntAndPeck' | 'mobileThumb';

export const personas: Record<PersonaName, TypingConfig> = {
  /** Quick, confident touch-typist. Few errors, tight rhythm. */
  fastDev: { wpm: 110, variability: 0.35, typoRate: 0.02, burstMean: 14 },

  /** An average office typist — the sensible default. */
  steady: { wpm: 65, variability: 0.45, typoRate: 0.04, smartErrorZones: true },

  /** Slow, error-prone two-finger typist with long thinking pauses. */
  huntAndPeck: { wpm: 28, variability: 0.7, typoRate: 0.08, burstMean: 5, stealth: true },

  /** Phone thumb-typing: bursty, high mid-word error rate, frequent pauses. */
  mobileThumb: { wpm: 38, variability: 0.6, typoRate: 0.09, burstMean: 6, smartErrorZones: true },
};
