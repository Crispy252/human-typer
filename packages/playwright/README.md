# @cadence/playwright

**Human-realistic typing for Playwright.** Drive the deterministic
[`@cadence/engine`](../engine) plan into a real page using genuine keyboard
events — so your tests exercise editors the way people actually type, and catch
the input-handling and race bugs that instant `fill()` hides.

## Why

`locator.fill()` sets the value in one shot. `keyboard.insertText()` skips
`keydown`. Both type at machine speed with perfect timing — nothing like a human.
Rich-text editors (ProseMirror, TipTap, Lexical, Quill, Slate, and
Google-Docs-style collaborative editors) have bugs that only surface under real
per-keystroke timing: dropped characters, broken undo grouping, IME races,
autosave that fires mid-edit. `humanType` reproduces that timing with real key
events — and does it **deterministically**, so a failure you see in CI replays
locally from the same seed.

## Install

```bash
npm install -D @cadence/playwright playwright
```

## Usage

```ts
import { test } from '@playwright/test';
import { humanType, personas } from '@cadence/playwright';

test('editor survives realistic typing', async ({ page }) => {
  await page.goto('/editor');

  // Locator form:
  await humanType(page.locator('.editor'), 'The quick brown fox.', {
    wpm: 90,
    typoRate: 0.05,   // real adjacent-key slips, self-corrected with Backspace
    seed: 'ci-42',    // same seed → identical keystrokes every run
  });

  // Page + selector form:
  await humanType(page, '#title', 'A headline', { ...personas.fastDev, seed: 1 });
});
```

`humanType` returns the executed `TypingPlan` (events, `totalMs`, resolved
`seed`), so even a "random" run can be pinned and replayed from its reported seed.

### Options

Everything from [`@cadence/engine`'s `TypingConfig`](../engine#config) (`wpm`,
`durationMs`, `typoRate`, `variability`, `fatigue`, `smartErrorZones`, `stealth`,
`seed`, …), plus execution controls:

| Option | Default | Meaning |
|---|---|---|
| `focus` | `true` | Click the target to focus and place the caret first. |
| `clear` | `false` | Select-all + delete before typing. |
| `speedFactor` | `1` | Scale every delay. `< 1` speeds up CI while preserving the *relative* rhythm (and thus the event ordering that exposes races); `0` runs as fast as the browser allows. |
| `maxDelayMs` | — | Clamp any single delay after scaling. |
| `onEvent` | — | Called after each event — for assertions or tracing. |

### Personas

`personas` ships recognisable presets — `fastDev`, `steady`, `huntAndPeck`,
`mobileThumb` — spread one and override as needed:

```ts
await humanType(locator, text, { ...personas.mobileThumb, seed: 'run-1' });
```

### Pre-built plans

Build a plan once and drive it (e.g. to inspect or cache it first):

```ts
import { planTyping, executePlan } from '@cadence/playwright';

const plan = planTyping(text, { wpm: 70, seed: 5 });
await executePlan(page.locator('.editor'), plan, { speedFactor: 0.5 });
```

## Development

```bash
npm install                       # from the monorepo root
npm run build -w @cadence/engine  # the wrapper imports the engine's build
npm test   -w @cadence/playwright # real-browser E2E via node --test
```

Tests launch actual Chromium and drive `humanType` into a textarea and a
contenteditable, asserting the typed result and that genuine trusted `keydown`
events fire.

## License

MIT
