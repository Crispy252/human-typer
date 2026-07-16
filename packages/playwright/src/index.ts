/**
 * @cadence/playwright — human-realistic typing for Playwright.
 *
 * Drives the deterministic @cadence/engine plan into a real page via genuine
 * keyboard events, so tests exercise editors the way people actually type.
 */
export { humanType, executePlan } from './human-type.ts';
export type { HumanTypeOptions } from './human-type.ts';
export { personas } from './personas.ts';
export type { PersonaName } from './personas.ts';

// Re-exported for convenience so callers need only one dependency in tests.
export { planTyping } from '@cadence/engine';
export type { TypingConfig, TypingEvent, TypingPlan } from '@cadence/engine';
