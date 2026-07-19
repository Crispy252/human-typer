import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTyping } from '@cadence/engine';
import { planToCypressOps, eventToTyped } from '../src/plan-to-ops.ts';
import type { CypressOp } from '../src/plan-to-ops.ts';

/**
 * Apply a Cypress `.type()` string to a buffer, honouring the token subset we
 * emit: {enter} → newline, {backspace} → delete, {{} → literal "{", else literal.
 */
function applyTyped(buffer: string, value: string): string {
  let out = buffer;
  for (let i = 0; i < value.length; i++) {
    if (value.startsWith('{enter}', i)) {
      out += '\n';
      i += 6;
    } else if (value.startsWith('{backspace}', i)) {
      out = out.slice(0, -1);
      i += 10;
    } else if (value.startsWith('{{}', i)) {
      out += '{';
      i += 2;
    } else {
      out += value[i];
    }
  }
  return out;
}

/** Simulate a run of ops (ignoring waits) into the final editor text. */
function applyOps(ops: CypressOp[]): string {
  let s = '';
  for (const op of ops) if (op.op === 'type') s = applyTyped(s, op.value);
  return s;
}

const SAMPLE = 'The quick brown fox. Pack my box with five dozen liquor jugs!';

test('ops reconstruct the source text exactly across seeds and typo rates', () => {
  for (const seed of [1, 2, 42, 'cy', 'race']) {
    const ops = planToCypressOps(planTyping(SAMPLE, { typoRate: 0.3, seed }));
    assert.equal(applyOps(ops), SAMPLE, `seed ${String(seed)} did not reconstruct`);
  }
});

test('newlines become {enter} and reconstruct', () => {
  const ops = planToCypressOps(planTyping('a\nb\nc', { typoRate: 0.2, seed: 7 }));
  assert.equal(applyOps(ops), 'a\nb\nc');
  assert.ok(ops.some((o) => o.op === 'type' && o.value.includes('{enter}')));
});

test('a literal "{" is escaped to {{} and round-trips', () => {
  const ops = planToCypressOps(planTyping('a{b', { typoRate: 0, seed: 1, coalesce: true }));
  const typed = ops.filter((o): o is { op: 'type'; value: string } => o.op === 'type').map((o) => o.value).join('');
  assert.ok(typed.includes('{{}'), 'expected escaped brace');
  assert.equal(applyOps(ops), 'a{b');
});

test('waits precede actions and are positive integers', () => {
  const ops = planToCypressOps(planTyping(SAMPLE, { seed: 3, wpm: 60 }));
  for (const op of ops) {
    if (op.op === 'wait') assert.ok(Number.isInteger(op.ms) && op.ms > 0, `bad wait ${op.ms}`);
  }
  // First op should be a wait (the delay before the first keystroke).
  assert.equal(ops[0]?.op, 'wait');
});

test('speedFactor 0 emits no waits and coalesces into a single type call', () => {
  const ops = planToCypressOps(planTyping('hello world', { typoRate: 0, seed: 5 }), { speedFactor: 0 });
  assert.equal(ops.filter((o) => o.op === 'wait').length, 0);
  assert.equal(ops.filter((o) => o.op === 'type').length, 1);
  assert.equal(applyOps(ops), 'hello world');
});

test('maxDelayMs clamps waits', () => {
  const ops = planToCypressOps(planTyping(SAMPLE, { seed: 8, wpm: 20 }), { maxDelayMs: 40 });
  for (const op of ops) if (op.op === 'wait') assert.ok(op.ms <= 40);
});

test('coalesce:false keeps one type op per keystroke', () => {
  const text = 'abcde';
  const ops = planToCypressOps(planTyping(text, { typoRate: 0, seed: 2 }), { speedFactor: 0, coalesce: false });
  assert.equal(ops.filter((o) => o.op === 'type').length, text.length);
});

test('eventToTyped maps the event kinds', () => {
  assert.equal(eventToTyped({ kind: 'enter', delayMs: 0 }), '{enter}');
  assert.equal(eventToTyped({ kind: 'backspace', delayMs: 0 }), '{backspace}');
  assert.equal(eventToTyped({ kind: 'key', char: 'x', delayMs: 0 }), 'x');
  assert.equal(eventToTyped({ kind: 'key', char: '{', delayMs: 0 }), '{{}');
  assert.equal(eventToTyped({ kind: 'pause', delayMs: 0 }), '');
});
