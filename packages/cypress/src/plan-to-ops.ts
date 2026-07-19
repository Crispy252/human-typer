/**
 * Translate a deterministic @cadence/engine plan into an ordered list of Cypress
 * operations: `type` a string, or `wait` a number of ms. This is the pure,
 * testable core of the Cypress command — it contains no `cy`, so its correctness
 * (including the reconstruction invariant) can be verified without a browser.
 */
import type { TypingEvent, TypingPlan } from '@cadence/engine';

export type CypressOp = { op: 'type'; value: string } | { op: 'wait'; ms: number };

export interface PlanToOpsOptions {
  /** Scale each delay before emitting a wait. `0` emits no waits. Default 1. */
  speedFactor?: number;
  /** Clamp any single wait (after scaling) to at most this many ms. */
  maxDelayMs?: number;
  /**
   * Merge consecutive `type` ops (those with no wait between them) into one
   * `.type()` call. Reduces command overhead; on by default. Note that with
   * `speedFactor: 0` this collapses the whole run into a single `.type()`.
   */
  coalesce?: boolean;
}

/** Cypress reads `{...}` as special key sequences, so a literal `{` is `{{}`. */
function escapeForCypress(ch: string): string {
  return ch === '{' ? '{{}' : ch;
}

/** The Cypress `.type()` token an event produces. */
export function eventToTyped(event: TypingEvent): string {
  switch (event.kind) {
    case 'enter':
      return '{enter}';
    case 'backspace':
      return '{backspace}';
    case 'key':
      return escapeForCypress(event.char ?? '');
    case 'pause':
      return '';
  }
}

export function planToCypressOps(plan: TypingPlan, options: PlanToOpsOptions = {}): CypressOp[] {
  const { speedFactor = 1, maxDelayMs, coalesce = true } = options;
  const ops: CypressOp[] = [];

  const pushType = (value: string) => {
    if (value === '') return;
    const last = ops[ops.length - 1];
    if (coalesce && last && last.op === 'type') last.value += value;
    else ops.push({ op: 'type', value });
  };

  for (const event of plan.events) {
    let delay = (event.delayMs || 0) * speedFactor;
    if (maxDelayMs != null) delay = Math.min(delay, maxDelayMs);
    // Wait BEFORE the action, matching the engine's "delay precedes event" model.
    if (delay > 0) ops.push({ op: 'wait', ms: Math.round(delay) });
    if (event.kind === 'pause') continue;
    pushType(eventToTyped(event));
  }

  return ops;
}
