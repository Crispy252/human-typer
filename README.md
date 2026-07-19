# Cadence

**Human-realistic typing for testing and demos.** Cadence types text into a page the way a
*person* does — burst-and-pause rhythm, natural jitter, fatigue, self-correcting typos — instead
of pasting it in one instant, perfect shot. That difference is the point: rich-text editors have
timing bugs that only appear at human speed, and instant-input tests sail right past them.

```ts
import { humanType, personas } from '@cadence/playwright';

await humanType(page.locator('.editor'), 'The quick brown fox.', {
  ...personas.fastDev,
  typoRate: 0.05,   // real adjacent-key slips, self-corrected with Backspace
  seed: 'ci-42',    // same seed → identical keystrokes every run
});
```

## The pitch, in one demo

The same editor, typed two ways:

| How the test types | Editor shows | Result |
|---|---|---|
| `locator.fill('hello world')` | `hello world` | passes — **the bug is hidden** |
| `humanType(locator, 'hello world')` | `dlrow olleh` | **catches the bug** |

That editor runs a perfectly ordinary async normalize pass after each input, but mishandles the
caret. `fill()` pastes everything at once, so the normalize runs once, harmlessly — green, and
falsely reassuring. `humanType()` types a key at a time, the normalize fires *between*
keystrokes, and the text comes out reversed. Run it yourself in
[`examples/race-demo/`](examples/race-demo/), or watch it live on the
[landing page](site/index.html).

## Packages

| Package | What it is |
|---|---|
| [`@cadence/engine`](packages/engine/) | The pure, dependency-free core. `planTyping(text, config)` → a deterministic, timed keystroke event stream. No DOM, no browser. Seedable, so runs reproduce exactly. |
| [`@cadence/playwright`](packages/playwright/) | The Playwright wrapper. `humanType(locator \| page, text, opts)` drives the plan into a real page via genuine `keydown`/`keypress`/`input`/`keyup` events — not `fill()`/`insertText`. |
| [`@cadence/cypress`](packages/cypress/) | The Cypress command. `cy.get(sel).humanType(text, opts)` types with the engine's cadence instead of instant `.type()`. |
| [`@cadence/ai`](packages/ai/) | Plain-English → a validated, executable session. Describe what a user does; Claude (Fable 5) authors a script; a pure compiler turns it into actions you drive with the wrappers above. |
| [`examples/race-demo`](examples/race-demo/) | The demo above, as four green tests: `fill()` gives false confidence; `humanType` catches the bug; the fix holds. |

## Why it works

`element.value = "…"` and naive `sendKeys` type at machine speed with perfect timing. People
don't — they burst, pause, slow down, and fix mistakes. Editors (Google-Docs-style collaborative
editors, ProseMirror, TipTap, Lexical, Quill, Slate) have races and input-handling bugs that only
surface under real per-keystroke timing. Cadence reproduces that timing with real key events —
**and does it deterministically**, so a failure in CI is a failure you can replay locally from the
same seed.

## Who it's for

- **Engineers and QA teams** building web apps with text editors — especially teams shipping
  collaborative or rich-text editors — who already test with Playwright or Cypress. They slot
  `humanType` into existing specs to catch timing bugs before users do.
- **Developer relations, marketing, and course creators** who record product demos and want
  on-screen typing that looks human, not robotic.

## Getting started

```bash
git clone <this repo> && cd TypeCloak
npm install
npm run build --workspace @cadence/engine
npm run build --workspace @cadence/playwright
npm test                                   # engine unit tests
npm test --workspace @cadence/playwright   # real-browser E2E
npm test --workspace @cadence/example-race-demo
```

See [`docs/BUILD_AND_SCALE_PLAN.md`](docs/BUILD_AND_SCALE_PLAN.md) for the product and go-to-market
plan.

## Origins

This repository began as **TypeCloak**, a Chrome extension that typed into LMS platforms to make
work look hand-typed — a use aimed at defeating academic-integrity checks. Cadence keeps the
genuinely valuable part of that project (the human-typing engine) and repositions it toward honest,
paying uses: testing editors and recording demos. The legacy extension still lives under
[`extension/`](extension/) (documented in [`extension/README.md`](extension/README.md)) and is
being retired in favour of the packages above; the rationale and plan are in
[`docs/BUILD_AND_SCALE_PLAN.md`](docs/BUILD_AND_SCALE_PLAN.md).

## License

MIT — see [LICENSE](LICENSE).
