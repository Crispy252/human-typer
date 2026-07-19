# Contributing to Cadence

Thanks for your interest. Cadence is an npm-workspaces monorepo:

- `packages/engine` — the pure typing model (no dependencies)
- `packages/playwright` — the Playwright wrapper
- `packages/cypress` — the Cypress command
- `examples/race-demo` — the "fill() hides a bug, humanType catches it" demo

## Setup

```bash
npm install
npm run build        # engine first, then the wrappers
```

Node 20+ is required. Tests run on Node's built-in test runner via native
TypeScript type-stripping — there's no separate test framework to install.

## Running tests

```bash
npm run test:unit      # engine + cypress — no browser needed
npm run test:browser   # playwright + race-demo — needs Chromium
npm run typecheck
```

Browser tests use Playwright's Chromium. If it isn't installed:
`npx playwright install chromium`.

## Ground rules

- **The engine stays pure.** No DOM, browser, network, or framework code in
  `@cadence/engine` — it only decides *what* to type and *when*. Wrappers do the
  driving.
- **Determinism is a feature.** Anything random must go through the seeded `Rng`,
  never `Math.random()`. A given seed must always produce the same plan.
- **Keep the reconstruction invariant.** Applying an engine plan (or a wrapper's
  translated ops) must reproduce the input text exactly. Tests enforce this; don't
  weaken them.
- **Match the surrounding style.** Small, focused changes; tests for new behaviour;
  no new runtime dependencies without discussion.

## Scope

Cadence is for testing software you own or are authorized to test, and for
recording demos. Changes that repurpose it to deceive a person or system
(defeating integrity or authorship checks) are out of scope and won't be merged.

## Pull requests

Keep PRs focused, describe the change and how you verified it, and make sure
`npm run build`, `npm run typecheck`, and the test suites pass. CI runs the same.
