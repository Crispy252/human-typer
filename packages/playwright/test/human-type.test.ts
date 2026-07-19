import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { humanType, executePlan, personas, planTyping } from '../src/index.ts';
import type { TypingEvent } from '../src/index.ts';

/**
 * Point Playwright at this container's pre-installed Chromium build when it
 * exists, so tests run without a download. Returns undefined elsewhere (e.g. CI),
 * where Playwright resolves the browser it installed itself.
 */
function resolveChrome(): string | undefined {
  try {
    const dir = readdirSync('/opt/pw-browsers').find((d) => d.startsWith('chromium-'));
    if (dir) return `/opt/pw-browsers/${dir}/chrome-linux/chrome`;
  } catch {
    // /opt/pw-browsers absent — fall through to Playwright's default resolution.
  }
  return undefined;
}

const PAGE = `
  <!doctype html><meta charset="utf-8">
  <textarea id="ta"></textarea>
  <div id="ce" contenteditable="true"></div>
  <script>
    window.__keydowns = 0;
    document.addEventListener('keydown', function () { window.__keydowns++; }, true);
  </script>`;

let browser: Browser;

before(async () => {
  browser = await chromium.launch({
    executablePath: resolveChrome(), // undefined → Playwright's own install
    headless: true,
    args: ['--no-sandbox'],
  });
});

after(async () => {
  await browser?.close();
});

async function freshPage(): Promise<Page> {
  const page = await browser.newPage();
  await page.setContent(PAGE);
  return page;
}

const FAST = { speedFactor: 0 } as const; // execute with real key events but no waits

test('types the exact text into a textarea, even with heavy typo correction', { timeout: 30000 }, async () => {
  const page = await freshPage();
  const text = 'The quick brown fox jumps over the lazy dog.\nSphinx of black quartz, judge my vow!';
  await humanType(page.locator('#ta'), text, { ...FAST, typoRate: 0.3, seed: 'e2e-1' });
  assert.equal(await page.locator('#ta').inputValue(), text);
  await page.close();
});

test('fires real, trusted keydown events (not synthetic insertText)', { timeout: 30000 }, async () => {
  const page = await freshPage();
  const text = 'hello world';
  await humanType(page.locator('#ta'), text, { ...FAST, typoRate: 0, seed: 1 });
  const keydowns = await page.evaluate(() => (window as unknown as { __keydowns: number }).__keydowns);
  // One keydown per character at minimum (typos/corrections would only add more).
  assert.ok(keydowns >= text.length, `expected >= ${text.length} keydowns, got ${keydowns}`);
  await page.close();
});

test('page + selector form focuses and types', { timeout: 30000 }, async () => {
  const page = await freshPage();
  await humanType(page, '#ta', 'focused via selector', { ...FAST, typoRate: 0, seed: 2 });
  assert.equal(await page.locator('#ta').inputValue(), 'focused via selector');
  await page.close();
});

test('types into a contenteditable element', { timeout: 30000 }, async () => {
  const page = await freshPage();
  const text = 'editable content, typed like a human';
  await humanType(page.locator('#ce'), text, { ...FAST, typoRate: 0.15, seed: 'ce' });
  assert.equal((await page.locator('#ce').textContent())?.trim(), text);
  await page.close();
});

test('clear replaces existing content', { timeout: 30000 }, async () => {
  const page = await freshPage();
  await page.locator('#ta').fill('stale value');
  await humanType(page.locator('#ta'), 'brand new', { ...FAST, clear: true, typoRate: 0, seed: 3 });
  assert.equal(await page.locator('#ta').inputValue(), 'brand new');
  await page.close();
});

test('same seed drives an identical event sequence into the page', { timeout: 30000 }, async () => {
  const capture: TypingEvent[][] = [[], []];
  for (const run of [0, 1]) {
    const page = await freshPage();
    await humanType(page.locator('#ta'), 'reproducible run', {
      ...FAST,
      typoRate: 0.2,
      seed: 'fixed',
      onEvent: (e) => capture[run]!.push(e),
    });
    assert.equal(await page.locator('#ta').inputValue(), 'reproducible run');
    await page.close();
  }
  assert.deepEqual(capture[0], capture[1]);
});

test('executePlan drives a pre-built plan and returns it', { timeout: 30000 }, async () => {
  const page = await freshPage();
  const plan = planTyping('pre-built plan', { typoRate: 0, seed: 9 });
  const returned = await executePlan(page.locator('#ta'), plan, FAST);
  assert.equal(await page.locator('#ta').inputValue(), 'pre-built plan');
  assert.equal(returned, plan);
  await page.close();
});

test('a persona config types the exact text', { timeout: 30000 }, async () => {
  const page = await freshPage();
  const text = 'typed by the hunt-and-peck persona';
  await humanType(page.locator('#ta'), text, { ...personas.huntAndPeck, ...FAST, seed: 'p' });
  assert.equal(await page.locator('#ta').inputValue(), text);
  await page.close();
});

test('multiline text types real newlines (Enter) into a textarea', { timeout: 30000 }, async () => {
  const page = await freshPage();
  const text = 'first line.\nsecond line, with a typo zone.\nthird!';
  await humanType(page.locator('#ta'), text, { ...FAST, typoRate: 0.2, seed: 'multi' });
  assert.equal(await page.locator('#ta').inputValue(), text);
  await page.close();
});

test('the durationMs option types the exact text', { timeout: 30000 }, async () => {
  const page = await freshPage();
  const text = 'paced to a fixed budget';
  const plan = await humanType(page.locator('#ta'), text, { ...FAST, durationMs: 30000, seed: 'dur' });
  assert.equal(await page.locator('#ta').inputValue(), text);
  // The plan itself is normalised to the requested duration (execution is sped up separately).
  assert.ok(Math.abs(plan.totalMs - 30000) < 1e-6);
  await page.close();
});
