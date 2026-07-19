/**
 * Compile a validated SessionScript into a flat, ordered list of executor
 * actions — resolving the persona, seed, and per-step config into concrete
 * typing config for each 'type' step. Pure and framework-agnostic; an executor
 * (Playwright/Cypress) turns these actions into `humanType` / press / clear calls.
 */
import { personas } from '@cadence/engine';
import type { TypingConfig } from '@cadence/engine';
import type { SessionScript } from './schema.ts';

export type SessionAction =
  | { kind: 'type'; selector: string; text: string; config: TypingConfig }
  | { kind: 'press'; selector: string; key: string }
  | { kind: 'clear'; selector: string };

/**
 * Resolve a script into actions. Precedence for a 'type' step's config
 * (lowest → highest): the persona preset, then the step's own `config`, then the
 * script-level `seed` (so every step in a run replays from the same seed).
 */
export function compileScript(script: SessionScript): SessionAction[] {
  const base: TypingConfig = script.persona ? { ...personas[script.persona] } : {};

  return script.steps.map((step): SessionAction => {
    switch (step.action) {
      case 'type': {
        const config: TypingConfig = { ...base, ...step.config };
        if (script.seed !== undefined) config.seed = script.seed;
        return { kind: 'type', selector: step.selector, text: step.text ?? '', config };
      }
      case 'press':
        return { kind: 'press', selector: step.selector, key: step.key ?? '' };
      case 'clear':
        return { kind: 'clear', selector: step.selector };
    }
  });
}
