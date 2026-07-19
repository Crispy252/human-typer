import { test } from 'node:test';
import assert from 'node:assert/strict';
import { humanTypeOnSubject, registerHumanType } from '../src/command.ts';
import type { CyChainable, CyLike, CypressLike } from '../src/command.ts';

/** A fake `cy` that records the chain of calls instead of touching a browser. */
function makeFakeCy(): { cy: CyLike; calls: string[] } {
  const calls: string[] = [];
  const chain: CyChainable = {
    type(text, options) {
      calls.push(`type(${JSON.stringify(text)},delay=${options?.delay ?? ''})`);
      return chain;
    },
    wait(ms) {
      calls.push(`wait(${ms})`);
      return chain;
    },
  };
  const cy: CyLike = {
    wrap(subject) {
      calls.push(`wrap(${JSON.stringify(subject)})`);
      return chain;
    },
  };
  return { cy, calls };
}

test('issues wrap first, then the ops in order, with delay:0 on every type', () => {
  const { cy, calls } = makeFakeCy();
  humanTypeOnSubject(cy, '<el>', 'hi', { typoRate: 0, seed: 1, wpm: 60 });

  assert.equal(calls[0], 'wrap("<el>")');
  assert.ok(calls.length > 1);
  // Every type call carries delay=0 (the engine, not Cypress, owns the timing).
  for (const c of calls) {
    if (c.startsWith('type(')) assert.ok(c.includes('delay=0'), c);
  }
  // Concatenated typed text reconstructs the input.
  const typed = calls
    .filter((c) => c.startsWith('type('))
    .map((c) => JSON.parse(c.slice('type('.length, c.lastIndexOf(',delay='))))
    .join('');
  assert.equal(typed, 'hi');
});

test('with waits enabled, a wait precedes the first type', () => {
  const { cy, calls } = makeFakeCy();
  humanTypeOnSubject(cy, 'el', 'ab', { typoRate: 0, seed: 2, wpm: 60 });
  const firstType = calls.findIndex((c) => c.startsWith('type('));
  const firstWait = calls.findIndex((c) => c.startsWith('wait('));
  assert.ok(firstWait >= 0 && firstWait < firstType, 'a wait should come before the first type');
});

test('speedFactor 0 issues no waits and a single type call', () => {
  const { cy, calls } = makeFakeCy();
  humanTypeOnSubject(cy, 'el', 'hello', { typoRate: 0, seed: 3, speedFactor: 0 });
  assert.equal(calls.filter((c) => c.startsWith('wait(')).length, 0);
  assert.equal(calls.filter((c) => c.startsWith('type(')).length, 1);
});

test('registerHumanType adds an element-subject command that drives the chain', () => {
  const { cy, calls } = makeFakeCy();
  let registered: { name: string; opts: unknown; fn: Function } | null = null;
  const Cypress: CypressLike = {
    Commands: {
      add(name, opts, fn) {
        registered = { name, opts, fn };
      },
    },
  };

  registerHumanType(Cypress, cy);
  assert.equal(registered?.name, 'humanType');
  assert.deepEqual(registered?.opts, { prevSubject: 'element' });

  // Invoking the registered command drives the fake cy.
  registered!.fn('el', 'x', { typoRate: 0, seed: 1, speedFactor: 0 });
  assert.equal(calls[0], 'wrap("el")');
  assert.ok(calls.some((c) => c.startsWith('type(')));
});

test('a custom command name is honoured', () => {
  const { cy } = makeFakeCy();
  let name = '';
  const Cypress: CypressLike = { Commands: { add(n) { name = n; } } };
  registerHumanType(Cypress, cy, 'typeLikeAHuman');
  assert.equal(name, 'typeLikeAHuman');
});
