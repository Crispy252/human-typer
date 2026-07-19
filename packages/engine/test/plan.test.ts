import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTyping } from '../src/plan.ts';
import type { TypingEvent } from '../src/types.ts';

/** Reconstruct the text an executor would produce by applying the event stream. */
function apply(events: TypingEvent[]): string {
  let out = '';
  for (const e of events) {
    if (e.kind === 'key') out += e.char ?? '';
    else if (e.kind === 'enter') out += '\n';
    else if (e.kind === 'backspace') out = out.slice(0, -1);
  }
  return out;
}

const SAMPLE =
  'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs!\n' +
  'How vexingly quick daft zebras jump? Sphinx of black quartz, judge my vow.';

test('reconstructs the source text exactly, even with a high typo rate', () => {
  for (const seed of [1, 2, 3, 42, 100, 7777]) {
    const plan = planTyping(SAMPLE, { typoRate: 0.25, seed });
    assert.equal(apply(plan.events), SAMPLE, `seed ${seed} did not reconstruct`);
  }
});

test('carriage returns are stripped from the output', () => {
  const plan = planTyping('a\r\nb\r\nc', { typoRate: 0.2, seed: 9 });
  assert.equal(apply(plan.events), 'a\nb\nc');
});

test('a pending typo at the very end is still corrected', () => {
  // Force typos on every character so a correction is almost surely pending at EOF.
  for (let seed = 0; seed < 40; seed++) {
    const plan = planTyping('abcdef', { typoRate: 1, seed });
    assert.equal(apply(plan.events), 'abcdef', `seed ${seed} left a dangling typo`);
  }
});

test('identical seed and config produce identical plans', () => {
  const a = planTyping(SAMPLE, { seed: 'cadence', typoRate: 0.1, stealth: true });
  const b = planTyping(SAMPLE, { seed: 'cadence', typoRate: 0.1, stealth: true });
  assert.deepEqual(a.events, b.events);
  assert.equal(a.seed, b.seed);
});

test('different seeds produce different plans', () => {
  const a = planTyping(SAMPLE, { seed: 1, typoRate: 0.1 });
  const b = planTyping(SAMPLE, { seed: 2, typoRate: 0.1 });
  assert.notDeepEqual(a.events, b.events);
});

test('durationMs makes the plan sum to the target duration', () => {
  const target = 30000;
  const plan = planTyping(SAMPLE, { durationMs: target, seed: 5, typoRate: 0.05 });
  assert.ok(Math.abs(plan.totalMs - target) < 1e-6);
  const sum = plan.events.reduce((s, e) => s + e.delayMs, 0);
  assert.ok(Math.abs(sum - target) < 1e-6, 'delays should sum to the target');
});

test('no typos means no backspaces and a verbatim key stream', () => {
  const plan = planTyping('hello world', { typoRate: 0, seed: 3 });
  assert.equal(plan.events.some((e) => e.kind === 'backspace'), false);
  assert.equal(apply(plan.events), 'hello world');
});

test('higher typo rate yields more corrections', () => {
  const low = planTyping(SAMPLE, { typoRate: 0.02, seed: 11 });
  const high = planTyping(SAMPLE, { typoRate: 0.3, seed: 11 });
  const bs = (es: TypingEvent[]) => es.filter((e) => e.kind === 'backspace').length;
  assert.ok(bs(high.events) > bs(low.events));
});

test('stealth mode adds reading pauses after newlines', () => {
  const plain = planTyping(SAMPLE, { seed: 4, stealth: false });
  const stealth = planTyping(SAMPLE, { seed: 4, stealth: true });
  const reads = stealth.events.filter((e) => e.reason === 'stealth-read').length;
  assert.ok(reads > 0, 'expected stealth-read pauses');
  assert.ok(stealth.totalMs > plain.totalMs, 'stealth should take longer');
});

test('every event carries a non-negative finite delay', () => {
  const plan = planTyping(SAMPLE, { seed: 6, typoRate: 0.2, fatigue: true, smartErrorZones: true });
  for (const e of plan.events) {
    assert.ok(Number.isFinite(e.delayMs) && e.delayMs >= 0, `bad delay: ${e.delayMs}`);
  }
});

test('empty input yields an empty, well-formed plan', () => {
  const plan = planTyping('', { seed: 1 });
  assert.equal(plan.events.length, 0);
  assert.equal(plan.totalMs, 0);
  assert.equal(plan.length, 0);
});
