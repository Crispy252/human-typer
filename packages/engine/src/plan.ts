/**
 * planTyping — turn text + a config into a deterministic, timed event stream.
 *
 * This is the pure heart of the engine. It contains none of the Chrome Debugger
 * Protocol, DOM, or storage code the original was fused to; it just decides
 * *what* to type and *when*. An executor (Playwright/Cypress plugin, a demo
 * recorder, the playground) consumes the stream: for each event, wait `delayMs`,
 * then perform the action.
 *
 * Reconstruction invariant: applying the events (append on `key`/`enter`, delete
 * last char on `backspace`, ignore `pause`) reproduces the input text with `\r`
 * stripped — typos are always corrected, including any pending at end of text.
 */
import { Rng, resolveSeed } from './rng.ts';
import { getAdjacentKey } from './qwerty.ts';
import {
  jitteredDelay,
  burstLength,
  fatigueMultiplier,
  smartErrorZoneMultiplier,
  sentencePauseMs,
} from './model.ts';
import type { TypingConfig, TypingEvent, TypingPlan } from './types.ts';

interface PendingCorrection {
  /** How many more characters to type before "noticing" the slip. */
  charsLeft: number;
  /** Characters to backspace over and retype: [correctChar, ...subsequentChars]. */
  toRetype: string[];
}

export function planTyping(text: string, config: TypingConfig = {}): TypingPlan {
  const {
    variability = 0.4,
    typoRate = 0.03,
    smartErrorZones = false,
    stealth = false,
    sentencePauses = true,
    burstMean = 10,
    wpm = 65,
  } = config;

  const fatigueFactor =
    config.fatigue === true ? 0.35 : typeof config.fatigue === 'number' ? config.fatigue : 0;

  const seed = resolveSeed(config.seed);
  const rng = new Rng(seed);

  const length = text.length;
  const events: TypingEvent[] = [];

  // Provisional per-character base delay. Absolute magnitude only matters when no
  // duration is given; with a duration we normalise to hit it exactly at the end.
  const baseMs = config.durationMs != null ? config.durationMs / Math.max(length, 1) : 12000 / wpm;

  let burstRem = burstLength(rng, burstMean);
  let wordStart = 0;
  let pending: PendingCorrection | null = null;

  const emitCorrection = (c: PendingCorrection) => {
    // Notice the mistake, backspace over everything typed since, then retype it.
    c.toRetype.forEach((_, idx) => {
      events.push({
        kind: 'backspace',
        delayMs: idx === 0 ? jitteredDelay(rng, 400, 0.3) : jitteredDelay(rng, 90, 0.3),
        reason: idx === 0 ? 'notice-typo' : 'backspace',
      });
    });
    for (const ch of c.toRetype) {
      events.push(
        ch === '\n'
          ? { kind: 'enter', delayMs: jitteredDelay(rng, 60, variability), reason: 'retype' }
          : { kind: 'key', char: ch, delayMs: jitteredDelay(rng, 60, variability), reason: 'retype' },
      );
    }
  };

  for (let i = 0; i < length; i++) {
    // Resolve a pending correction before typing the current character.
    if (pending && pending.charsLeft === 0) {
      emitCorrection(pending);
      pending = null;
    }

    // Burst boundary: a longer thinking pause, then a fresh burst length.
    if (burstRem === 0) {
      events.push({ kind: 'pause', delayMs: 300 + rng.next() * 1200, reason: 'burst-pause' });
      burstRem = burstLength(rng, burstMean);
    }

    const ch = text[i];

    if (ch === '\r') {
      // Carriage returns are skipped entirely, matching the original engine.
      burstRem--;
      continue;
    }

    const inBurst = burstRem > 0;

    // Track position within the current word for smart error zones.
    if (ch === ' ' || ch === '\n') wordStart = i + 1;
    const wordLen = i - wordStart + 1;
    let fullWordLen = wordLen;
    for (let k = i + 1; k < Math.min(i + 20, length); k++) {
      if (text[k] === ' ' || text[k] === '\n') break;
      fullWordLen++;
    }
    const wordPos = fullWordLen > 1 ? (wordLen - 1) / (fullWordLen - 1) : 0;

    const effectiveTypoRate = smartErrorZones
      ? typoRate * smartErrorZoneMultiplier(wordPos)
      : typoRate;

    const progress = length > 1 ? i / (length - 1) : 1;
    const fatigue = fatigueFactor ? fatigueMultiplier(progress, fatigueFactor) : 1;
    const burstFactor = inBurst ? 0.7 : 1;
    const effectiveBase = baseMs * burstFactor * fatigue;
    const delayMs = jitteredDelay(rng, effectiveBase, variability);

    if (ch === '\n') {
      events.push({ kind: 'enter', delayMs, reason: 'newline' });
      if (pending) {
        pending.charsLeft--;
        pending.toRetype.push('\n');
      }
    } else if (!pending && rng.next() < effectiveTypoRate) {
      const wrong = getAdjacentKey(rng, ch);
      if (wrong) {
        // Type the wrong key now; the correct char is queued for correction.
        events.push({ kind: 'key', char: wrong, delayMs, reason: 'typo' });
        pending = { charsLeft: rng.int(0, 4), toRetype: [ch] };
      } else {
        events.push({ kind: 'key', char: ch, delayMs });
      }
    } else {
      events.push({ kind: 'key', char: ch, delayMs });
      if (pending) {
        pending.charsLeft--;
        pending.toRetype.push(ch);
      }
    }

    // Sentence-boundary thinking pause.
    if (sentencePauses) {
      const sPause = sentencePauseMs(rng, text, i);
      if (sPause > 0) events.push({ kind: 'pause', delayMs: sPause, reason: 'sentence' });
    }

    // Stealth: re-reading pause after paragraphs, rare in-burst micro-hesitations.
    if (stealth) {
      if (ch === '\n') {
        events.push({ kind: 'pause', delayMs: 800 + rng.next() * 2000, reason: 'stealth-read' });
      }
      if (inBurst && rng.next() < 0.06) {
        events.push({ kind: 'pause', delayMs: 100 + rng.next() * 350, reason: 'stealth-hesitation' });
      }
    }

    burstRem--;
  }

  // Flush any correction still pending at end of text so the output always
  // reconstructs the source exactly (the original engine could leave a dangling typo).
  if (pending) emitCorrection(pending);

  let totalMs = events.reduce((sum, e) => sum + e.delayMs, 0);

  // Normalise to the requested duration, if any, so the plan finishes on time.
  if (config.durationMs != null && totalMs > 0) {
    const factor = config.durationMs / totalMs;
    for (const e of events) e.delayMs *= factor;
    totalMs = config.durationMs;
  }

  return { events, totalMs, seed, length };
}
