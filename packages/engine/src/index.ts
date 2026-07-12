/**
 * @cadence/engine — human-realistic typing simulation.
 *
 * Pure, deterministic, dependency-free. `planTyping` turns text into a timed
 * event stream you can drive into any target (Playwright, Cypress, a demo
 * recorder, a canvas). No DOM or browser APIs live in here.
 */
export { planTyping } from './plan.ts';
export { Rng, hashSeed, resolveSeed } from './rng.ts';
export {
  jitteredDelay,
  burstLength,
  fatigueMultiplier,
  smartErrorZoneMultiplier,
  sentencePauseMs,
} from './model.ts';
export { ADJACENT_KEYS, getAdjacentKey } from './qwerty.ts';
export type {
  TypingConfig,
  TypingEvent,
  TypingEventKind,
  TypingPlan,
} from './types.ts';
