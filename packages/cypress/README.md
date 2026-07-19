# @cadence/cypress

**Human-realistic typing for Cypress.** Adds a `cy.humanType()` command that types
with the deterministic [`@cadence/engine`](../engine) cadence — burst-and-pause
rhythm, jitter, self-correcting typos — instead of instant `.type()`, so specs
exercise editors at real per-keystroke timing and catch the bugs instant input
hides.

## Install

```bash
npm install -D @cadence/cypress
```

`cypress` is an optional peer dependency — bring your own.

## Setup

Register the command once in your support file (`cypress/support/e2e.ts`):

```ts
import { registerHumanType } from '@cadence/cypress';

registerHumanType(Cypress, cy);
```

Then use it in specs:

```ts
import { personas } from '@cadence/cypress';

it('editor survives realistic typing', () => {
  cy.visit('/editor');
  cy.get('.editor').humanType('The quick brown fox.', {
    ...personas.fastDev,
    typoRate: 0.05,   // real adjacent-key slips, self-corrected
    seed: 'ci-42',    // same keystrokes every run
  });
});
```

### TypeScript

Add the command to Cypress's chainable interface:

```ts
import type { HumanTypeOptions } from '@cadence/cypress';

declare global {
  namespace Cypress {
    interface Chainable {
      humanType(text: string, options?: HumanTypeOptions): Chainable<JQuery<HTMLElement>>;
    }
  }
}
```

## Options

Everything from [`@cadence/engine`'s `TypingConfig`](../engine#config) (`wpm`,
`durationMs`, `typoRate`, `variability`, `fatigue`, `smartErrorZones`, `stealth`,
`seed`, …), plus:

| Option | Default | Meaning |
|---|---|---|
| `speedFactor` | `1` | Scale each delay. `0` emits no waits and types in one call (fast, but no timing pressure). |
| `maxDelayMs` | — | Clamp any single wait. |
| `coalesce` | `true` | Merge adjacent keystrokes with no wait between them into one `.type()` call. |

## How it maps to Cypress

`planToCypressOps(plan, options)` turns an engine plan into an ordered list of
`{ op: 'type', value }` / `{ op: 'wait', ms }` operations. Keystrokes become
`.type()` calls (`Enter` → `{enter}`, `Backspace` → `{backspace}`, a literal `{`
is escaped to `{{}`); delays become `cy.wait()`. Applying the ops reconstructs the
input text exactly — the same reconstruction guarantee the engine makes.

## Development

```bash
npm install                        # from the monorepo root; Cypress is NOT required
npm run build --workspace @cadence/engine
npm test  --workspace @cadence/cypress   # unit tests, no browser needed
```

The command's translation logic is unit-tested against the ops model and a fake
`cy` (verifying call order, `delay: 0` on every type, and reconstruction), so the
package builds and tests without the Cypress runtime installed.

## License

MIT
