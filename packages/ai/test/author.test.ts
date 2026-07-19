import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorScript, buildPrompt, extractJson } from '../src/author.ts';
import { compileScript } from '../src/compile.ts';
import { personas } from '@cadence/engine';

test('buildPrompt includes the description, page context, and field selectors', () => {
  const prompt = buildPrompt('type a title then tab away', {
    page: '/editor',
    fields: [{ selector: '#title', label: 'Title', kind: 'input' }],
  });
  assert.match(prompt, /type a title then tab away/);
  assert.match(prompt, /\/editor/);
  assert.match(prompt, /selector: #title/);
  assert.match(prompt, /"action": "type"\|"press"\|"clear"/);
});

test('extractJson handles fenced, chatty, and bare JSON', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('Sure! Here you go: {"a":2} — done.'), { a: 2 });
  assert.deepEqual(extractJson('{"a":3}'), { a: 3 });
  assert.throws(() => extractJson('no json here'), /no JSON object/);
  assert.throws(() => extractJson('{not valid}'), /not valid JSON/);
});

test('authorScript validates the generated script and passes the prompt through', async () => {
  let seenPrompt = '';
  const generate = async (prompt: string) => {
    seenPrompt = prompt;
    return JSON.stringify({
      persona: 'steady',
      seed: 'demo',
      steps: [
        { action: 'type', selector: '#title', text: 'Hello' },
        { action: 'press', selector: '#title', key: 'Tab' },
      ],
    });
  };

  const script = await authorScript('type Hello into the title and tab', { generate });
  assert.match(seenPrompt, /type Hello into the title and tab/);
  assert.equal(script.persona, 'steady');
  assert.equal(script.steps.length, 2);
});

test('authorScript rejects an empty description before calling the model', async () => {
  let called = false;
  const generate = async () => {
    called = true;
    return '{}';
  };
  await assert.rejects(() => authorScript('   ', { generate }), /must not be empty/);
  assert.equal(called, false);
});

test('authorScript surfaces malformed model output as a clear error', async () => {
  const generate = async () => 'the editor looks fine to me';
  await assert.rejects(() => authorScript('do something', { generate }), /no JSON object/);
});

test('authored script compiles to actions with persona + seed applied', async () => {
  const generate = async () =>
    JSON.stringify({
      persona: 'fastDev',
      seed: 'run-7',
      steps: [
        { action: 'clear', selector: '#t' },
        { action: 'type', selector: '#t', text: 'Hi', config: { typoRate: 0.1 } },
        { action: 'press', selector: '#t', key: 'Enter' },
      ],
    });

  const script = await authorScript('clear, type Hi, press enter', { generate });
  const actions = compileScript(script);

  assert.deepEqual(actions[0], { kind: 'clear', selector: '#t' });
  assert.equal(actions[1]!.kind, 'type');
  const typeAction = actions[1] as Extract<(typeof actions)[number], { kind: 'type' }>;
  // persona preset merged, step config overrides, script seed applied last
  assert.equal(typeAction.config.wpm, personas.fastDev.wpm);
  assert.equal(typeAction.config.typoRate, 0.1);
  assert.equal(typeAction.config.seed, 'run-7');
  assert.deepEqual(actions[2], { kind: 'press', selector: '#t', key: 'Enter' });
});
