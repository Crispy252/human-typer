# Your editor tests type nothing like a human — and that's hiding bugs

*Draft launch post for Hacker News / dev communities. Working title.*

Here's a test that passes. It's also lying to you.

```ts
await page.locator('.editor').fill('hello world');
await expect(page.locator('.editor')).toHaveText('hello world'); // ✅ green
```

The editor under test is broken. That test will never tell you, because `fill()`
doesn't type — it sets the value in one shot. Real users type one key at a time,
and a whole category of editor bugs lives in the gaps between keystrokes.

## The gap between keystrokes

Rich-text editors do work *per input event*: sanitize pasted markup, collapse
whitespace, re-render from a model, autosave, reconcile collaborative state. A lot
of that work is asynchronous — a `setTimeout`, a microtask, a debounce, a
`requestAnimationFrame`. When all your text arrives at once, that async work runs
*once*, after everything is already in place, and everything looks fine. When text
arrives a key at a time, the async work interleaves *between* keystrokes — and
that's where the races are.

Here's a minimal, real example. This editor runs an ordinary post-input normalize
pass, but mismanages the caret:

```js
editor.addEventListener('input', () => {
  model = editor.value;
  setTimeout(() => {
    editor.value = model;             // re-render from the model
    editor.setSelectionRange(0, 0);   // ...and reset the caret. the bug.
  }, 5);
});
```

Paste `"hello world"` with `fill()` and the normalize runs once, harmlessly:
green. Type it a key at a time and the normalize fires between keystrokes, sending
the caret back to the start, so every new character lands at the front:

```
fill('hello world')        → "hello world"   ✅  (bug hidden)
humanType('hello world')   → "dlrow olleh"   ❌  (bug caught)
```

Same code. Same assertion. The only difference is timing — and timing is exactly
what instant-input tests throw away.

## Typing like a person, on purpose

So we built the thing that types like a person: **Cadence**. The core is a pure,
dependency-free engine that turns text into a deterministic, timed keystroke
stream — burst-and-pause rhythm, per-key jitter, end-of-session fatigue, and
adjacent-key typos it notices and backspaces to fix:

```ts
import { planTyping } from '@cadence/engine';

const plan = planTyping('hello world', { wpm: 90, typoRate: 0.05, seed: 'ci-42' });
// → [{ kind:'key', char:'h', delayMs: 41 }, { kind:'pause', delayMs: 380 }, ...]
```

It's just a plan — no DOM, no browser. A thin wrapper drives it into a real page
using **genuine key events** (`keydown`/`keypress`/`input`/`keyup`), not `fill()`
or `insertText`:

```ts
import { humanType, personas } from '@cadence/playwright';

await humanType(page.locator('.editor'), 'The quick brown fox.', {
  ...personas.fastDev,
  typoRate: 0.05,
  seed: 'ci-42',
});
```

Cypress too, if that's your stack:

```ts
cy.get('.editor').humanType('The quick brown fox.', { ...personas.fastDev, seed: 'ci-42' });
```

## The part that makes it usable in CI: determinism

"Type randomly" is a non-starter for tests — a flake you can't reproduce is worse
than no test. So the randomness is seeded. The same `seed` produces the exact same
keystrokes and the exact same timing, every run, on every machine. A failure you
see in CI is a failure you can replay locally on the first try. `planTyping` even
returns the resolved seed, so a "random" run can be pinned after the fact.

## What this is good for (and what it isn't)

Use it to test software you own or are authorized to test: does your editor survive
realistic typing? Does undo group correctly? Does autosave fire at a sane time?
Does an IME-style burst break anything? It's also handy for recording product demos
where instant paste looks robotic.

It is **not** a tool for making typing look human to fool a person or a system —
that's the opposite of the point, and not a use we build for. (Cadence is, candidly,
a repositioning of an older project that pointed this engine the wrong way; the
engineering was worth keeping, the target wasn't.)

## Try it

```bash
npm install -D @cadence/playwright playwright
```

The engine, both wrappers (Playwright + Cypress), and a runnable version of the
demo above — four tests where `fill()` gives a false green and `humanType` catches
the bug — are MIT-licensed and in the repo. Point it at your own editor and see what
falls out of the gaps.
