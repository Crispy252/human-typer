/**
 * The artifact: a timing bug that `fill()` hides and `humanType` catches.
 *
 * `buggy-editor.html` reproduces a real class of bug — an async normalize pass
 * that resets the caret after input. It is invisible when text is set all at
 * once, and corrupts input when characters arrive with human timing.
 *
 * These four tests all PASS. Together they show the point: test 1 is green even
 * though the editor is broken (fill gives false confidence); test 2 is the same
 * editor failing under realistic typing; tests 3–4 show the fix holds.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { humanType } from '@cadence/playwright';

const here = dirname(fileURLToPath(import.meta.url));
const buggyHtml = readFileSync(join(here, '..', 'buggy-editor.html'), 'utf8');
const fixedHtml = readFileSync(join(here, '..', 'fixed-editor.html'), 'utf8');

const TEXT = 'hello world';
/** Same characters, canonical order — lets us prove "reordered, nothing lost". */
const multiset = (s: string) => s.split('').sort().join('');

function resolveChrome(): string | undefined {
  try {
    const dir = readdirSync('/opt/pw-browsers').find((d) => d.startsWith('chromium-'));
    if (dir) return `/opt/pw-browsers/${dir}/chrome-linux/chrome`;
  } catch {
    /* CI: fall back to Playwright's own install */
  }
  return undefined;
}

let browser: Browser;
before(async () => {
  browser = await chromium.launch({
    executablePath: resolveChrome(),
    headless: true,
    args: ['--no-sandbox'],
  });
});
after(async () => {
  await browser?.close();
});

async function open(html: string): Promise<Page> {
  const page = await browser.newPage();
  await page.setContent(html);
  return page;
}
const readValue = (page: Page) =>
  page.evaluate(() => (window as unknown as { getEditorValue(): string }).getEditorValue());

// Human typing fast enough to be quick, but with real gaps between keystrokes
// so the editor's async normalize fires in between. No typos, so any corruption
// is the editor's bug, not the input.
const TYPING = { wpm: 240, typoRate: 0, variability: 0.2, seed: 'race-demo' } as const;

test('fill() on the BUGGY editor looks fine — false confidence', { timeout: 30000 }, async () => {
  const page = await open(buggyHtml);
  await page.locator('#editor').fill(TEXT);
  assert.equal(await readValue(page), TEXT, 'instant fill hides the bug');
  await page.close();
});

test('humanType() on the BUGGY editor exposes the bug', { timeout: 30000 }, async () => {
  const page = await open(buggyHtml);
  await humanType(page.locator('#editor'), TEXT, TYPING);
  const value = await readValue(page);
  // The developer's intended assertion `value === TEXT` would FAIL here:
  assert.notEqual(value, TEXT, 'realistic typing surfaces the caret race');
  // …and it is corruption of *ordering*, not lost characters:
  assert.equal(value.length, TEXT.length);
  assert.equal(multiset(value), multiset(TEXT));
  await page.close();
});

test('humanType() on the FIXED editor is correct — the fix holds', { timeout: 30000 }, async () => {
  const page = await open(fixedHtml);
  await humanType(page.locator('#editor'), TEXT, TYPING);
  assert.equal(await readValue(page), TEXT);
  await page.close();
});

test('fill() on the FIXED editor is correct', { timeout: 30000 }, async () => {
  const page = await open(fixedHtml);
  await page.locator('#editor').fill(TEXT);
  assert.equal(await readValue(page), TEXT);
  await page.close();
});
