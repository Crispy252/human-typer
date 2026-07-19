# Releasing the Cadence packages

The monorepo publishes three packages to npm:

- `@cadence/engine` — the pure core (no dependencies)
- `@cadence/playwright` — depends on `@cadence/engine`
- `@cadence/cypress` — depends on `@cadence/engine`
- `@cadence/ai` — depends on `@cadence/engine` and `@anthropic-ai/sdk`

## Before publishing

```bash
npm install                 # from the repo root
npm run build               # engine first, then the wrappers
npm run typecheck
npm run test:unit           # engine + cypress (no browser)
npm run test:browser        # playwright + race-demo (needs Chromium)
```

CI (`.github/workflows/ci.yml`) runs the same on every push.

## What ships

Each package's `files` field ships `dist/` (compiled `.js` + `.d.ts`), `src/`, and
its `README.md`; npm always adds `package.json` and `LICENSE`. Verify a tarball
before publishing:

```bash
cd packages/engine && npm pack --dry-run
```

The `build` script cleans `dist/` first, so a stale output from an earlier build
never leaks into the tarball.

## Publishing

Publish `@cadence/engine` first (the wrappers depend on it), then the wrappers.
The packages are public and scoped, so the first publish of each needs
`--access public`:

```bash
npm publish --workspace @cadence/engine --access public
npm publish --workspace @cadence/playwright --access public
npm publish --workspace @cadence/cypress --access public
npm publish --workspace @cadence/ai --access public
```

Bump versions in lockstep (they share a `^0.1.0` range on the engine). A tool like
[changesets](https://github.com/changesets/changesets) is the natural next step
once releases become frequent.

## Notes

- `playwright` and `cypress` are **optional peer dependencies** of their wrappers,
  so installing a wrapper never drags in a browser engine or the Cypress binary.
- `examples/*` are `private` and never published.
