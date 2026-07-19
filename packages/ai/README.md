# @cadence/ai

**Describe a user session in plain English; get a validated, executable Cadence
session.** An LLM (Claude **Fable 5** by default) authors a `SessionScript` from
your description; a pure compiler turns it into ordered actions you drive with
[`@cadence/playwright`](../playwright) or [`@cadence/cypress`](../cypress).

The model sits behind an injected `generate` function, so the schema, validator,
and compiler are fully usable — and testable — **without an API key**.

## Why

`humanType(locator, 'The quick brown fox.', { wpm: 90, seed: 'ci-42' })` already
types like a person. This lowers the authoring floor from *code* to *English*:

> *"A fast typist clears the title, types 'Launch plan', tabs to the body, and
> writes two sentences with the occasional typo."*

…becomes a validated script your test runs at real human timing — reproducibly.

## Install

```bash
npm install @cadence/ai
```

Set `ANTHROPIC_API_KEY` (or use an `ant auth login` profile). Fable 5 requires an
org with 30-day data retention.

## Usage

```ts
import { createAnthropicAuthor, compileScript } from '@cadence/ai';
import { humanType } from '@cadence/playwright';

const author = createAnthropicAuthor(); // Claude Fable 5, Opus 4.8 fallback

const script = await author(
  "A fast typist clears the title, types 'Launch plan', tabs to the body, and writes two sentences.",
  { page: '/editor', fields: [
    { selector: '#title', label: 'Title', kind: 'input' },
    { selector: '.editor', label: 'Body', kind: 'contenteditable' },
  ] },
);

// Execute the compiled actions with your driver of choice:
for (const action of compileScript(script)) {
  const locator = page.locator(action.selector);
  if (action.kind === 'type') await humanType(locator, action.text, action.config);
  else if (action.kind === 'press') await locator.press(action.key);
  else if (action.kind === 'clear') await locator.fill('');
}
```

Grounding the author with your page's `fields` yields correct selectors — pass
them whenever you can.

## Fable 5 handling

The Anthropic adapter is built for Fable 5's contract: no `thinking` config (it's
always on), no sampling parameters, **structured outputs** force a JSON object
matching the `SessionScript` schema, the `refusal` stop reason is surfaced as an
error, and **server-side fallback to Opus 4.8 is enabled by default** so a
false-positive safety refusal is retried automatically. Override the model or
fallback via `createAnthropicAuthor({ model, fallbackModel })`; pass
`fallbackModel: null` to disable the fallback.

## Bring your own model

`authorScript(description, { generate })` accepts any `generate: (prompt) =>
Promise<string>` that returns JSON — wire up a different provider, a local model,
or a canned response in tests. `parseSessionScript` validates whatever comes back
before it can run:

```ts
import { authorScript } from '@cadence/ai';

const script = await authorScript('type a title and tab away', {
  generate: async (prompt) => callMyModel(prompt), // returns JSON text
});
```

## Safety boundary

Never execute raw model output. `parseSessionScript(value)` is the validator every
path goes through — it checks structure and types, sanitises the per-step config
(dropping unknown keys), and throws a clear error on anything malformed. It's pure
and dependency-free.

## Development

```bash
npm install                    # @anthropic-ai/sdk is a normal dependency
npm run build --workspace @cadence/engine
npm test  --workspace @cadence/ai   # pure unit tests — no API key, no network
```

The schema/validator, prompt building, JSON extraction, and the compiler are
tested against a fake `generate`, so the suite runs offline.

## License

MIT
