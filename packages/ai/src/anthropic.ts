/**
 * Anthropic adapter — a `Generate` implementation backed by the Claude API,
 * defaulting to Claude Fable 5.
 *
 * Fable 5 specifics handled here: thinking is always on (we send no `thinking`
 * config), sampling params are omitted, structured outputs force a JSON object
 * matching the SessionScript schema, the `refusal` stop reason is surfaced as an
 * error, and server-side fallbacks to Opus 4.8 are enabled by default (the
 * recommended Fable 5 pattern) so a false-positive safety refusal is retried
 * automatically. Requires ANTHROPIC_API_KEY (or an `ant auth login` profile) and
 * an org with 30-day data retention.
 */
import Anthropic from '@anthropic-ai/sdk';
import { authorScript } from './author.ts';
import type { AuthorContext, Generate } from './author.ts';
import { SESSION_SCRIPT_SCHEMA } from './schema.ts';
import type { SessionScript } from './schema.ts';

export interface AnthropicAuthorConfig {
  /** API key. Omit to use the environment / `ant auth login` profile. */
  apiKey?: string;
  /** Model id. Default 'claude-fable-5'. */
  model?: string;
  /** Max output tokens. Default 4096. */
  maxTokens?: number;
  /** Fallback model on a safety refusal. Default 'claude-opus-4-8'; null disables. */
  fallbackModel?: string | null;
  /** Provide a pre-configured client (e.g. a platform client) instead of constructing one. */
  client?: Anthropic;
}

/** Build a `Generate` function that calls Claude and returns the JSON text. */
export function createGenerate(config: AnthropicAuthorConfig = {}): Generate {
  const client = config.client ?? new Anthropic(config.apiKey ? { apiKey: config.apiKey } : {});
  const model = config.model ?? 'claude-fable-5';
  const maxTokens = config.maxTokens ?? 4096;
  const fallbackModel = config.fallbackModel === undefined ? 'claude-opus-4-8' : config.fallbackModel;

  return async (prompt: string): Promise<string> => {
    // `output_config` (structured outputs) and `fallbacks` are current API
    // features that the installed SDK version doesn't yet type; the request shape
    // is per the Claude API docs. Cast bridges the type lag without changing the
    // wire request.
    const params = {
      model,
      max_tokens: maxTokens,
      // Force a JSON object matching the SessionScript schema.
      output_config: { format: { type: 'json_schema', schema: SESSION_SCRIPT_SCHEMA } },
      // Enable server-side fallback on a safety refusal (recommended for Fable 5).
      ...(fallbackModel
        ? { betas: ['server-side-fallback-2026-06-01'], fallbacks: [{ model: fallbackModel }] }
        : {}),
      messages: [{ role: 'user' as const, content: prompt }],
    };

    const response = await client.beta.messages.create(
      params as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
    );

    if (response.stop_reason === 'refusal') {
      throw new Error('the model declined to author this session (safety refusal)');
    }

    const blocks = response.content as ReadonlyArray<{ type: string; text?: string }>;
    const text = blocks
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
    if (!text) throw new Error('the model returned no text output');
    return text;
  };
}

/**
 * Convenience: an authoring function bound to a Claude client. Call it with a
 * plain-English description (and optional page context) to get a SessionScript.
 */
export function createAnthropicAuthor(
  config?: AnthropicAuthorConfig,
): (description: string, context?: AuthorContext) => Promise<SessionScript> {
  const generate = createGenerate(config);
  return (description, context) => authorScript(description, { generate, context });
}
