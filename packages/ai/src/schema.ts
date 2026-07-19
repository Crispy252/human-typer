/**
 * The SessionScript schema — the structured shape an LLM produces from a
 * plain-English description, and the runtime validator that guards it.
 *
 * The validator is pure and dependency-free: whatever a model (or a person)
 * hands us, `parseSessionScript` either returns a well-formed SessionScript or
 * throws a clear error. Never trust raw model output — run it through here first.
 */
import type { TypingConfig, PersonaName } from '@cadence/engine';

/** A single action in a session: type text, press a key, or clear a field. */
export interface SessionStep {
  action: 'type' | 'press' | 'clear';
  /** CSS selector for the target element. */
  selector: string;
  /** Text to type — required when `action` is `'type'`. */
  text?: string;
  /** Key to press (e.g. `'Enter'`, `'Tab'`) — required when `action` is `'press'`. */
  key?: string;
  /** Per-step typing overrides (merged over the persona/seed defaults). */
  config?: TypingConfig;
}

/** A full authored session: a persona, a seed, and an ordered list of steps. */
export interface SessionScript {
  persona?: PersonaName;
  seed?: string | number;
  steps: SessionStep[];
}

const PERSONAS: readonly PersonaName[] = ['fastDev', 'steady', 'huntAndPeck', 'mobileThumb'];
const ACTIONS: readonly SessionStep['action'][] = ['type', 'press', 'clear'];

/**
 * JSON Schema handed to the model via structured outputs so it returns a
 * SessionScript directly. Kept within the structured-output subset (every object
 * sets `additionalProperties: false`; no string/number constraints).
 */
export const SESSION_SCRIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    persona: { type: 'string', enum: [...PERSONAS] },
    seed: { anyOf: [{ type: 'string' }, { type: 'number' }] },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string', enum: [...ACTIONS] },
          selector: { type: 'string' },
          text: { type: 'string' },
          key: { type: 'string' },
          config: {
            type: 'object',
            additionalProperties: false,
            properties: {
              wpm: { type: 'number' },
              typoRate: { type: 'number' },
              variability: { type: 'number' },
              stealth: { type: 'boolean' },
              smartErrorZones: { type: 'boolean' },
            },
          },
        },
        required: ['action', 'selector'],
      },
    },
  },
  required: ['steps'],
} as const;

/** The typing-config keys we accept from untrusted (model) output. */
const CONFIG_NUMBER_KEYS = ['wpm', 'typoRate', 'variability', 'durationMs', 'burstMean'] as const;
const CONFIG_BOOL_KEYS = ['stealth', 'smartErrorZones', 'sentencePauses'] as const;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sanitizeConfig(value: unknown, where: string): TypingConfig | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value)) throw new Error(`${where}: config must be an object`);
  const config: TypingConfig = {};
  for (const key of CONFIG_NUMBER_KEYS) {
    const v = value[key];
    if (v !== undefined) {
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${where}: config.${key} must be a number`);
      (config as Record<string, unknown>)[key] = v;
    }
  }
  for (const key of CONFIG_BOOL_KEYS) {
    const v = value[key];
    if (v !== undefined) {
      if (typeof v !== 'boolean') throw new Error(`${where}: config.${key} must be a boolean`);
      (config as Record<string, unknown>)[key] = v;
    }
  }
  const fatigue = value.fatigue;
  if (fatigue !== undefined) {
    if (typeof fatigue !== 'boolean' && typeof fatigue !== 'number') {
      throw new Error(`${where}: config.fatigue must be a boolean or number`);
    }
    config.fatigue = fatigue;
  }
  return config;
}

/**
 * Validate and normalise an untrusted value into a SessionScript. Throws a
 * descriptive Error on anything malformed — this is the safety boundary between
 * model output and execution.
 */
export function parseSessionScript(value: unknown): SessionScript {
  if (!isObject(value)) throw new Error('session script must be an object');

  if (value.persona !== undefined && !PERSONAS.includes(value.persona as PersonaName)) {
    throw new Error(`unknown persona: ${JSON.stringify(value.persona)}`);
  }
  if (value.seed !== undefined && typeof value.seed !== 'string' && typeof value.seed !== 'number') {
    throw new Error('seed must be a string or number');
  }
  if (!Array.isArray(value.steps) || value.steps.length === 0) {
    throw new Error('session script must have a non-empty `steps` array');
  }

  const steps: SessionStep[] = value.steps.map((raw, i) => {
    const where = `step ${i}`;
    if (!isObject(raw)) throw new Error(`${where}: must be an object`);
    if (!ACTIONS.includes(raw.action as SessionStep['action'])) {
      throw new Error(`${where}: action must be one of ${ACTIONS.join(', ')}`);
    }
    if (typeof raw.selector !== 'string' || raw.selector.trim() === '') {
      throw new Error(`${where}: selector must be a non-empty string`);
    }
    const action = raw.action as SessionStep['action'];
    const step: SessionStep = { action, selector: raw.selector };

    if (action === 'type') {
      if (typeof raw.text !== 'string') throw new Error(`${where}: a 'type' step needs a string 'text'`);
      step.text = raw.text;
    } else if (action === 'press') {
      if (typeof raw.key !== 'string' || raw.key === '') throw new Error(`${where}: a 'press' step needs a 'key'`);
      step.key = raw.key;
    }

    const config = sanitizeConfig(raw.config, where);
    if (config) step.config = config;
    return step;
  });

  const script: SessionScript = { steps };
  if (value.persona !== undefined) script.persona = value.persona as PersonaName;
  if (value.seed !== undefined) script.seed = value.seed as string | number;
  return script;
}
