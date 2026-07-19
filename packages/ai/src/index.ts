/**
 * @cadence/ai — plain-English → a validated, executable Cadence session.
 *
 * Describe a user session in words; an LLM (Claude Fable 5 by default) authors a
 * SessionScript; `compileScript` turns it into ordered actions you drive with
 * @cadence/playwright or @cadence/cypress. The model sits behind an injected
 * `Generate` function, so the schema, validator, and compiler need no API key.
 */
export { parseSessionScript, SESSION_SCRIPT_SCHEMA } from './schema.ts';
export type { SessionScript, SessionStep } from './schema.ts';
export { compileScript } from './compile.ts';
export type { SessionAction } from './compile.ts';
export { authorScript, buildPrompt, extractJson } from './author.ts';
export type { AuthorContext, AuthorOptions, Generate, PageField } from './author.ts';
export { createGenerate, createAnthropicAuthor } from './anthropic.ts';
export type { AnthropicAuthorConfig } from './anthropic.ts';

// Re-exported for convenience.
export { personas } from '@cadence/engine';
export type { TypingConfig, PersonaName } from '@cadence/engine';
