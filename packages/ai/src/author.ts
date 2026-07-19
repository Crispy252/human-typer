/**
 * authorScript — turn a plain-English description of a user session into a
 * validated SessionScript, using an injected `generate` function for the LLM
 * call. Keeping the model behind `generate` means the prompt construction and
 * output validation are testable with a fake generator — no API key required.
 */
import { parseSessionScript } from './schema.ts';
import type { SessionScript } from './schema.ts';

/** A field on the page the author can target, to ground the model's selectors. */
export interface PageField {
  selector: string;
  label?: string;
  kind?: string; // e.g. 'textarea', 'contenteditable', 'input'
}

export interface AuthorContext {
  /** URL or short description of the page under test (optional, for grounding). */
  page?: string;
  /** Known fields the script may target. Strongly recommended for good selectors. */
  fields?: PageField[];
}

/** Produces a JSON string from a prompt. Wrap any LLM here (see anthropic.ts). */
export type Generate = (prompt: string) => Promise<string>;

export interface AuthorOptions {
  generate: Generate;
  context?: AuthorContext;
}

/** Pull a JSON object out of a model response that may be fenced or chatty. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('no JSON object found in the model response');
  }
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch (err) {
    throw new Error(`model response was not valid JSON: ${(err as Error).message}`);
  }
}

/** Build the instruction prompt describing the task and the required output shape. */
export function buildPrompt(description: string, context: AuthorContext = {}): string {
  const lines: string[] = [
    'You author realistic user-session scripts for testing web apps. Given a plain-English',
    'description of what a user does, output a JSON object describing the steps to perform.',
    '',
    'Output ONLY a JSON object with this shape:',
    '{ "persona"?: "fastDev"|"steady"|"huntAndPeck"|"mobileThumb",',
    '  "seed"?: string|number,',
    '  "steps": [ { "action": "type"|"press"|"clear", "selector": string,',
    '              "text"?: string, "key"?: string,',
    '              "config"?: { "wpm"?: number, "typoRate"?: number, "variability"?: number,',
    '                           "stealth"?: boolean, "smartErrorZones"?: boolean } } ] }',
    '',
    'Rules:',
    '- A "type" step needs "text"; a "press" step needs "key" (e.g. "Enter", "Tab").',
    '- Use the provided field selectors verbatim. Do not invent selectors.',
    '- Choose a persona that matches the described user; pick a "seed" for reproducibility.',
  ];

  if (context.page) lines.push('', `Page under test: ${context.page}`);
  if (context.fields?.length) {
    lines.push('', 'Available fields:');
    for (const f of context.fields) {
      const parts = [`selector: ${f.selector}`];
      if (f.label) parts.push(`label: ${f.label}`);
      if (f.kind) parts.push(`kind: ${f.kind}`);
      lines.push(`- ${parts.join(', ')}`);
    }
  }

  lines.push('', 'User session to script:', description);
  return lines.join('\n');
}

/**
 * Author a SessionScript from a description. Throws if the model output can't be
 * parsed into a valid script.
 */
export async function authorScript(description: string, options: AuthorOptions): Promise<SessionScript> {
  if (!description.trim()) throw new Error('description must not be empty');
  const raw = await options.generate(buildPrompt(description, options.context));
  return parseSessionScript(extractJson(raw));
}
