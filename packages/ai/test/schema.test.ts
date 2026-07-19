import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSessionScript } from '../src/schema.ts';

const valid = {
  persona: 'fastDev',
  seed: 'ci-1',
  steps: [
    { action: 'clear', selector: '#title' },
    { action: 'type', selector: '#title', text: 'A headline', config: { wpm: 90, typoRate: 0.05 } },
    { action: 'press', selector: '#title', key: 'Tab' },
    { action: 'type', selector: '.editor', text: 'Body text.' },
  ],
};

test('accepts a well-formed script and preserves fields', () => {
  const script = parseSessionScript(valid);
  assert.equal(script.persona, 'fastDev');
  assert.equal(script.seed, 'ci-1');
  assert.equal(script.steps.length, 4);
  assert.deepEqual(script.steps[1]!.config, { wpm: 90, typoRate: 0.05 });
});

test('rejects a missing or empty steps array', () => {
  assert.throws(() => parseSessionScript({ steps: [] }), /non-empty/);
  assert.throws(() => parseSessionScript({}), /steps/);
  assert.throws(() => parseSessionScript(null), /must be an object/);
});

test('rejects an unknown persona and a bad seed', () => {
  assert.throws(() => parseSessionScript({ persona: 'wizard', steps: valid.steps }), /unknown persona/);
  assert.throws(() => parseSessionScript({ seed: {}, steps: valid.steps }), /seed must be/);
});

test('rejects an unknown action', () => {
  assert.throws(
    () => parseSessionScript({ steps: [{ action: 'scroll', selector: '#x' }] }),
    /action must be one of/,
  );
});

test('a type step requires text; a press step requires a key', () => {
  assert.throws(() => parseSessionScript({ steps: [{ action: 'type', selector: '#x' }] }), /needs a string 'text'/);
  assert.throws(() => parseSessionScript({ steps: [{ action: 'press', selector: '#x' }] }), /needs a 'key'/);
});

test('rejects an empty selector', () => {
  assert.throws(
    () => parseSessionScript({ steps: [{ action: 'clear', selector: '   ' }] }),
    /selector must be a non-empty string/,
  );
});

test('sanitizes config: drops unknown keys, type-checks known ones', () => {
  const script = parseSessionScript({
    steps: [{ action: 'type', selector: '#x', text: 'hi', config: { wpm: 60, evil: 'x', stealth: true } }],
  });
  assert.deepEqual(script.steps[0]!.config, { wpm: 60, stealth: true });
  assert.throws(
    () => parseSessionScript({ steps: [{ action: 'type', selector: '#x', text: 'hi', config: { wpm: 'fast' } }] }),
    /config.wpm must be a number/,
  );
});

test('accepts fatigue as boolean or number', () => {
  assert.doesNotThrow(() =>
    parseSessionScript({ steps: [{ action: 'type', selector: '#x', text: 'hi', config: { fatigue: true } }] }),
  );
  assert.doesNotThrow(() =>
    parseSessionScript({ steps: [{ action: 'type', selector: '#x', text: 'hi', config: { fatigue: 0.4 } }] }),
  );
  assert.throws(
    () => parseSessionScript({ steps: [{ action: 'type', selector: '#x', text: 'hi', config: { fatigue: 'lots' } }] }),
    /fatigue must be a boolean or number/,
  );
});
