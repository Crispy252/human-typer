import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng, hashSeed, resolveSeed } from '../src/rng.ts';

test('same seed produces an identical stream', () => {
  const a = new Rng(12345);
  const b = new Rng(12345);
  const seqA = Array.from({ length: 50 }, () => a.next());
  const seqB = Array.from({ length: 50 }, () => b.next());
  assert.deepEqual(seqA, seqB);
});

test('different seeds diverge', () => {
  const a = new Rng(1);
  const b = new Rng(2);
  assert.notEqual(a.next(), b.next());
});

test('next() stays in [0, 1)', () => {
  const rng = new Rng(999);
  for (let i = 0; i < 10000; i++) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('int() is inclusive on both ends and never escapes the range', () => {
  const rng = new Rng(7);
  let sawMin = false;
  let sawMax = false;
  for (let i = 0; i < 5000; i++) {
    const v = rng.int(0, 4);
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 4);
    if (v === 0) sawMin = true;
    if (v === 4) sawMax = true;
  }
  assert.ok(sawMin && sawMax, 'expected to observe both endpoints');
});

test('normal() is roughly zero-mean', () => {
  const rng = new Rng(42);
  let sum = 0;
  const n = 100000;
  for (let i = 0; i < n; i++) sum += rng.normal();
  assert.ok(Math.abs(sum / n) < 0.02, `mean drifted: ${sum / n}`);
});

test('hashSeed is stable and resolveSeed maps strings through it', () => {
  assert.equal(hashSeed('cadence'), hashSeed('cadence'));
  assert.notEqual(hashSeed('a'), hashSeed('b'));
  assert.equal(resolveSeed('cadence'), hashSeed('cadence'));
  assert.equal(resolveSeed(123), 123);
});
