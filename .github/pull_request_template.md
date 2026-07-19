<!-- Thanks for contributing to Cadence. Keep PRs focused. -->

## What & why

<!-- What does this change, and what problem does it solve? -->

## How it was verified

<!-- Commands run and what you observed. -->

- [ ] `npm run build`
- [ ] `npm run typecheck`
- [ ] `npm run test:unit`
- [ ] `npm run test:browser` (if the change touches a wrapper or example)

## Checklist

- [ ] The engine stays pure (no DOM/browser/framework code in `@cadence/engine`).
- [ ] Any randomness goes through the seeded `Rng` — same seed, same plan.
- [ ] The reconstruction invariant still holds (applying a plan reproduces the input text).
- [ ] New behaviour has tests; existing tests pass.
