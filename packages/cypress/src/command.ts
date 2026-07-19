/**
 * The `cy.humanType()` command: plan the typing with @cadence/engine, translate
 * it to Cypress ops, and issue them as a Cypress command chain.
 *
 * We depend on Cypress only structurally (the handful of methods we call), so the
 * package builds and unit-tests without the Cypress runtime installed. At runtime
 * it attaches to the real global `Cypress`/`cy`.
 */
import { planTyping } from '@cadence/engine';
import type { TypingConfig } from '@cadence/engine';
import { planToCypressOps } from './plan-to-ops.ts';
import type { PlanToOpsOptions } from './plan-to-ops.ts';

export interface HumanTypeOptions extends TypingConfig, PlanToOpsOptions {}

/** The subset of a Cypress chainable this command uses. */
export interface CyChainable {
  type(text: string, options?: { delay?: number }): CyChainable;
  wait(ms: number): CyChainable;
}
/** The subset of the `cy` global this command uses. */
export interface CyLike {
  wrap(subject: unknown): CyChainable;
}
/** The subset of the `Cypress` global this command uses. */
export interface CypressLike {
  Commands: {
    add(
      name: string,
      options: { prevSubject: 'element' },
      fn: (subject: unknown, text: string, options?: HumanTypeOptions) => CyChainable,
    ): void;
  };
}

/**
 * Drive a human-typing plan into `subject` and return the resulting chain.
 * Exposed directly so the translation can be exercised without registering a
 * global command.
 */
export function humanTypeOnSubject(
  cy: CyLike,
  subject: unknown,
  text: string,
  options: HumanTypeOptions = {},
): CyChainable {
  const plan = planTyping(text, options);
  const ops = planToCypressOps(plan, options);
  let chain = cy.wrap(subject);
  for (const op of ops) {
    chain = op.op === 'wait' ? chain.wait(op.ms) : chain.type(op.value, { delay: 0 });
  }
  return chain;
}

/**
 * Register `cy.humanType(text, options?)` as an element-subject command.
 * Call once from your Cypress support file:
 *
 * ```ts
 * import { registerHumanType } from '@cadence/cypress';
 * registerHumanType(Cypress, cy);
 * ```
 */
export function registerHumanType(Cypress: CypressLike, cy: CyLike, name = 'humanType'): void {
  Cypress.Commands.add(name, { prevSubject: 'element' }, (subject, text, options) =>
    humanTypeOnSubject(cy, subject, text, options),
  );
}
