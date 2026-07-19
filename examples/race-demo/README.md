# Demo: the bug `fill()` hides and `humanType` catches

This is the demo that explains why `@cadence/playwright` exists.

`buggy-editor.html` is a small editor with a **real, common class of bug**: after
each input it runs an async "normalize" pass that re-renders the field from its
model — but resets the caret to the start. Lots of real rich-text editors run a
post-input normalize like this (sanitizing pasted markup, collapsing whitespace,
re-rendering from a model); getting the caret wrong is an easy mistake.

The bug is **invisible to instant input** and **obvious under human timing**:

| How the test types | Editor shows | Test result |
|---|---|---|
| `locator.fill('hello world')` | `hello world` ✅ | passes — **bug hidden** |
| `humanType(locator, 'hello world')` | `dlrow olleh` ❌ | catches it |

With `fill()`, the whole string lands at once and the normalize runs once, after
everything is already in place — so nothing breaks and the test is green. That
green is **false confidence**. With `humanType`, characters arrive with real gaps,
the normalize fires *between* keystrokes and keeps sending the caret to position
0, so every new character is inserted at the front and the text comes out
reversed.

`fixed-editor.html` is the same editor with the caret preserved; it stays correct
under `humanType`.

## Run it

```bash
npm install                 # from the monorepo root
npm run build --workspace @cadence/engine
npm run build --workspace @cadence/playwright
npm test   --workspace @cadence/example-race-demo
```

`test/race.test.ts` has four tests, **all green**, that together tell the story:

1. `fill()` on the buggy editor passes — the false green.
2. `humanType()` on the buggy editor exposes the corruption (same characters,
   reordered — nothing dropped).
3. `humanType()` on the fixed editor is correct — the fix holds under real timing.
4. `fill()` on the fixed editor is correct.

The run is deterministic: the same `seed` reproduces the same keystrokes, so a
failure you see here is a failure you can replay.
