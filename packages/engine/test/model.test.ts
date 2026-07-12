import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/rng.ts';
import {
  jitteredDelay,
  burstLength,
  fatigueMultiplier,
  smartErrorZoneMultiplier,
  sentencePauseMs,
} from '../src/model.ts';

test('jitteredDelay respects the 20ms floor and centres on base', () => {
  const rng = new Rng(3);
  let sum = 0;
  const n = 20000;
  const base = 100;
  for (let i = 0; i < n; i++) {
    const d = jitteredDelay(rng, base, 0.4);
    assert.ok(d >= 20);
    sum += d;
  }
  const mean = sum / n;
  assert.ok(Math.abs(mean - base) < 3, `mean off: ${mean}`);
});

test('zero variability yields the base delay exactly', () => {
  const rng = new Rng(1);
  assert.equal(jitteredDelay(rng, 80, 0), 80);
});

test('burstLength has the expected mean and a sane floor', () => {
  const rng = new Rng(5);
  let sum = 0;
  const n = 50000;
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    const b = burstLength(rng, 10);
    min = Math.min(min, b);
    sum += b;
  }
  const mean = sum / n;
  // Exponential(mean 10) shifted by +3, then floored → expected ≈ 12.5.
  assert.ok(mean > 11 && mean < 15, `burst mean off: ${mean}`);
  // The floor is 2, not 3: when next()→1 the exponent floors to -1 before +3.
  assert.ok(min >= 2, `burst dipped below floor: ${min}`);
});

test('fatigueMultiplier runs from 1.0 to 1+factor monotonically', () => {
  assert.equal(fatigueMultiplier(0, 0.35), 1);
  assert.ok(Math.abs(fatigueMultiplier(1, 0.35) - 1.35) < 1e-9);
  let prev = -Infinity;
  for (let p = 0; p <= 1.0001; p += 0.05) {
    const m = fatigueMultiplier(p, 0.35);
    assert.ok(m >= prev, 'fatigue should be non-decreasing');
    prev = m;
  }
});

test('smartErrorZoneMultiplier peaks mid-word and is low at the edges', () => {
  const edge = smartErrorZoneMultiplier(0);
  const mid = smartErrorZoneMultiplier(0.5);
  const end = smartErrorZoneMultiplier(1);
  assert.ok(mid > edge && mid > end, 'middle should be the peak');
  assert.ok(Math.abs(edge - end) < 1e-9, 'edges should be symmetric');
  // At the very edge (wordPos 0/1) the bell curve sits at ~0.5x; the peak is ~1.8x.
  assert.ok(edge < 0.55 && mid > 1.7, 'expected ~0.5 edge / ~1.8 peak');
});

test('sentencePauseMs fires only on terminal punctuation followed by a space', () => {
  const rng = new Rng(2);
  const text = 'Hi. Yo? No! End';
  assert.ok(sentencePauseMs(rng, text, 2) > 0, 'after "." + space');
  assert.ok(sentencePauseMs(rng, text, 6) > 0, 'after "?" + space');
  assert.ok(sentencePauseMs(rng, text, 10) > 0, 'after "!" + space');
  assert.equal(sentencePauseMs(rng, text, 0), 0, 'not on a letter');
  assert.equal(sentencePauseMs(rng, 'a.b', 1), 0, 'no pause when not followed by space');
});
