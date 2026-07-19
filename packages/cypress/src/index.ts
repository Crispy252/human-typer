/**
 * @cadence/cypress — human-realistic typing for Cypress.
 *
 * Adds a `cy.humanType()` command that types with the deterministic
 * @cadence/engine cadence instead of instant `.type()`, so specs exercise
 * editors at real per-keystroke timing.
 */
export { planToCypressOps, eventToTyped } from './plan-to-ops.ts';
export type { CypressOp, PlanToOpsOptions } from './plan-to-ops.ts';
export { humanTypeOnSubject, registerHumanType } from './command.ts';
export type { HumanTypeOptions, CyLike, CyChainable, CypressLike } from './command.ts';

// Convenience re-exports so a spec needs only this one dependency.
export { planTyping, personas } from '@cadence/engine';
export type { TypingConfig, TypingEvent, TypingPlan, PersonaName } from '@cadence/engine';
