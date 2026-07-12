# @cadence/engine

**Human-realistic typing simulation.** Turn text into a deterministic, timed
keystroke event stream — burst-and-pause cadence, jittered delays, end-of-session
fatigue, sentence pauses, and self-correcting QWERTY typos — with a seedable RNG so
the *same* human-like sequence replays on every run.

Pure, dependency-free, and framework-agnostic. It contains no DOM, browser, or
timing code — it just decides **what** to type and **when**. You drive the stream
into whatever target you like: a Playwright/Cypress test, a demo recorder, a canvas.

## Why

`element.value = "..."` and naive `sendKeys` type at machine speed with perfect
timing. Real users don't — they burst, pause, slow down, and fix mistakes. Rich-text
editors (Google-Docs-style collaborative editors, ProseMirror, TipTap, Lexical, Quill,
Slate) have race conditions and input-handling bugs that **only surface at human
timing**. This engine reproduces that timing so your tests can catch them — and does it
*deterministically*, so a failure you see in CI is a failure you can replay locally.

## Install

```bash
npm install @cadence/engine
```

## Usage

```ts
import { planTyping } from '@cadence/engine';

const plan = planTyping('Hello, world. This is a test!', {
  wpm: 65,
  typoRate: 0.05,
  variability: 0.4,
  fatigue: true,
  seed: 'ci-run-42', // same seed → identical plan, every time
});

// Drive the stream into any target:
for (const e of plan.events) {
  await sleep(e.delayMs); // wait first
  switch (e.kind) {
    case 'key':       await target.press(e.char); break;
    case 'enter':     await target.press('Enter'); break;
    case 'backspace': await target.press('Backspace'); break;
    case 'pause':     /* nothing to type — just the delay */ break;
  }
}
```

Applying the stream (`key`/`enter` append, `backspace` deletes the last character,
`pause` waits) reconstructs your input text exactly — typos are always corrected,
including any still pending at the end of the text.

## Config

| Option | Default | Meaning |
|---|---|---|
| `durationMs` | — | Target total time; the plan is normalised to sum to it exactly. |
| `wpm` | `65` | Words-per-minute when `durationMs` is not set (1 word = 5 chars). |
| `variability` | `0.4` | Inter-keystroke spread, 0 (robotic) → 1 (erratic). |
| `typoRate` | `0.03` | Per-character adjacent-key typo probability. |
| `fatigue` | `false` | `true` = 35% slower by the end; a number sets the fraction. |
| `smartErrorZones` | `false` | Cluster typos mid-word (bell curve) instead of uniformly. |
| `stealth` | `false` | Reading pauses after newlines + rare in-burst hesitations. |
| `sentencePauses` | `true` | Pause after `.`/`?`/`!`. |
| `seed` | random | Number or string. Omit for a clock-derived seed. |
| `burstMean` | `10` | Mean characters per burst before a thinking pause. |

`planTyping` returns `{ events, totalMs, seed, length }`. The resolved numeric `seed`
is always returned — so even a "random" run can be pinned and reproduced later.

## Development

```bash
npm install        # only devDependency is TypeScript
npm test           # runs the suite natively via `node --test` (no build needed)
npm run build      # emit dist/ (.js + .d.ts)
npm run playground # serve the live demo at http://localhost:4173/
```

Tests run directly against the TypeScript sources using Node's built-in type
stripping — no test runner or transpile step required.

## License

MIT
