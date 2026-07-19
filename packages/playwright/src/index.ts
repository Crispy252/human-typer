/**
 * @cadence/playwright — human-realistic typing for Playwright.
 *
 * Drives the deterministic @cadence/engine plan into a real page via genuine
 * keyboard events, so tests exercise editors the way people actually type.
 */
export { humanType, executePlan } from './human-type.ts';
export type { HumanTypeOptions } from './human-type.ts';

// Re-exported for convenience so callers need only one dependency in tests.
// `personas` lives in the engine (they're pure config presets) and is surfaced
// here so existing `import { personas } from '@cadence/playwright'` keeps working.
export { planTyping, personas } from '@cadence/engine';
export type { TypingConfig, TypingEvent, TypingPlan, PersonaName } from '@cadence/engine';
