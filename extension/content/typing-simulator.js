/**
 * Google Docs Typing Simulator
 * Simulates realistic human typing with variable speed, mistakes, and corrections.
 *
 * Uses the Chrome Debugger API (via background/message-handler.js) to fire real
 * trusted keyboard events — the only reliable way to inject text into Google Docs
 * from an extension, since Docs ignores synthetic (isTrusted:false) events.
 *
 * Exported as window.typingSimulator for use by ui-injector.js.
 */

// QWERTY adjacent key map for realistic typos
const ADJACENT_KEYS = {
  'a': ['s', 'q', 'w', 'z'],
  'b': ['v', 'g', 'h', 'n'],
  'c': ['x', 'd', 'f', 'v'],
  'd': ['s', 'e', 'r', 'f', 'c', 'x'],
  'e': ['w', 'r', 'd', 's'],
  'f': ['d', 'r', 't', 'g', 'v', 'c'],
  'g': ['f', 't', 'y', 'h', 'b', 'v'],
  'h': ['g', 'y', 'u', 'j', 'n', 'b'],
  'i': ['u', 'o', 'k', 'j'],
  'j': ['h', 'u', 'i', 'k', 'm', 'n'],
  'k': ['j', 'i', 'o', 'l', 'm'],
  'l': ['k', 'o', 'p', ';'],
  'm': ['n', 'j', 'k', ','],
  'n': ['b', 'h', 'j', 'm'],
  'o': ['i', 'p', 'l', 'k'],
  'p': ['o', '[', 'l', ';'],
  'q': ['w', 'a', 's'],
  'r': ['e', 't', 'f', 'd'],
  's': ['a', 'w', 'e', 'd', 'x', 'z'],
  't': ['r', 'y', 'g', 'f'],
  'u': ['y', 'i', 'j', 'h'],
  'v': ['c', 'f', 'g', 'b'],
  'w': ['q', 'e', 's', 'a'],
  'x': ['z', 's', 'd', 'c'],
  'y': ['t', 'u', 'h', 'g'],
  'z': ['a', 's', 'x'],
  '0': ['9', '-', 'p', 'o'],
  '1': ['2', 'q'],
  '2': ['1', '3', 'q', 'w'],
  '3': ['2', '4', 'w', 'e'],
  '4': ['3', '5', 'e', 'r'],
  '5': ['4', '6', 'r', 't'],
  '6': ['5', '7', 't', 'y'],
  '7': ['6', '8', 'y', 'u'],
  '8': ['7', '9', 'u', 'i'],
  '9': ['8', '0', 'i', 'o'],
  ' ': ['c', 'v', 'b', 'n', 'm'],
  ',': ['m', 'k', 'l', '.'],
  '.': [',', 'l', ';', '/'],
};

function getAdjacentKey(ch) {
  const lower = ch.toLowerCase();
  const neighbors = ADJACENT_KEYS[lower];
  if (!neighbors || neighbors.length === 0) return null;
  const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
  return ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? pick.toUpperCase() : pick;
}

// Approximate normal distribution using CLT on 3 uniform samples
function normalRandom() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

function jitteredDelay(baseMs, variability) {
  const spread = variability * 0.8;
  return Math.max(20, baseMs * (1 + normalRandom() * spread));
}

function randomBurstLength() {
  // Poisson-like: mean ~10 characters per burst
  return Math.floor(-Math.log(Math.random() + 0.001) * 10) + 3;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isDocEditable() {
  return !!(
    document.querySelector('.docs-texteventtarget-iframe') ||
    document.querySelector('.kix-appview-editor')
  );
}

// ─── Chrome Debugger API bridge ───────────────────────────────────────────────
// All text injection goes through the background script, which uses the
// Chrome Debugger Protocol (CDP). This creates trusted events that Google Docs
// actually responds to.

function bgSend(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}

async function cdpAttach() {
  const res = await bgSend({ type: 'DEBUGGER_ATTACH' });
  return res && res.success;
}

async function cdpDetach() {
  await bgSend({ type: 'DEBUGGER_DETACH' });
}

// Insert a printable character or string at the current cursor position.
// Uses CDP Input.insertText — the cleanest API for IME / programmatic input.
async function cdpInsertText(text) {
  await bgSend({ type: 'DEBUGGER_INSERT_TEXT', text });
}

// Dispatch a special key (Backspace, Enter) via CDP Input.dispatchKeyEvent.
async function cdpKey(key, code, keyCode) {
  const params = {
    type: 'keyDown',
    key, code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  };
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params });
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params: { ...params, type: 'keyUp' } });
}

async function dispatchChar(ch) {
  await cdpInsertText(ch);
}

async function dispatchBackspace() {
  await cdpKey('Backspace', 'Backspace', 8);
}

async function dispatchEnter() {
  await cdpKey('Enter', 'Enter', 13);
}
// ─────────────────────────────────────────────────────────────────────────────

// Estimate total typing time for pacing (used to compute the scaling factor)
function estimateTotalTime(text, baseDelayMs, variability, typoRate) {
  let total = 0;
  let burstRem = randomBurstLength();
  for (let i = 0; i < text.length; i++) {
    if (burstRem === 0) {
      total += 800; // avg thinking pause
      burstRem = randomBurstLength();
    }
    const burstFactor = burstRem > 0 ? 0.7 : 1.0;
    total += baseDelayMs * burstFactor;
    burstRem--;
    if (Math.random() < typoRate) {
      total += baseDelayMs * 6; // typo overhead
    }
  }
  return total;
}

class TypingSimulator {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this._stopRequested = false;
  }

  /**
   * Start typing the given text over the specified duration.
   * @param {string} text - Text to type
   * @param {object} settings - { durationMinutes, variability (0-1), typoRate (0-1) }
   * @param {function} onProgress - Callback: (fraction, charsTyped, total)
   * @returns {Promise<void>}
   */
  async start(text, settings, onProgress) {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;
    this._stopRequested = false;

    const { durationMinutes, variability = 0.4, typoRate = 0.03 } = settings;
    const targetMs = durationMinutes * 60 * 1000;
    const roughBase = targetMs / text.length;

    const estimated = estimateTotalTime(text, roughBase, variability, typoRate);
    const scale = targetMs / Math.max(estimated, 1);
    const scaledBase = roughBase * scale;

    // Attach the Chrome Debugger — this is what makes typing actually work
    const attached = await cdpAttach();
    if (!attached) {
      this.isRunning = false;
      if (onProgress) onProgress(-1, 0, text.length); // signal error
      return;
    }

    let burstRem = randomBurstLength();
    let i = 0;
    let pendingCorrection = null; // { countdown, correctBuffer }
    const startTime = Date.now();

    try {
      while (i < text.length) {
        if (this._stopRequested) break;

        while (this.isPaused) {
          await sleep(100);
          if (this._stopRequested) break;
        }
        if (this._stopRequested) break;

        // Burst transition — pause to simulate thinking
        if (burstRem === 0) {
          const thinkMs = (300 + Math.random() * 1200) * scale;
          await sleep(thinkMs);
          burstRem = randomBurstLength();
        }

        const ch = text[i];
        const inBurst = burstRem > 0;

        if (ch === '\n') {
          await dispatchEnter();
        } else if (ch === '\r') {
          // skip
        } else {
          // Possibly inject a typo
          if (!pendingCorrection && Math.random() < typoRate) {
            const wrongChar = getAdjacentKey(ch);
            if (wrongChar) {
              await dispatchChar(wrongChar);
              await sleep(jitteredDelay(scaledBase * (inBurst ? 0.7 : 1.0), variability));
              const noticeAfter = Math.floor(Math.random() * 5);
              pendingCorrection = { countdown: noticeAfter, correctBuffer: [ch] };
            } else {
              await dispatchChar(ch);
            }
          } else {
            await dispatchChar(ch);
          }
        }

        // Handle pending typo correction
        if (pendingCorrection) {
          if (pendingCorrection.countdown === 0) {
            await sleep(jitteredDelay(scaledBase * 1.5, 0.3));
            const deleteCount = pendingCorrection.correctBuffer.length + 1;
            for (let b = 0; b < deleteCount; b++) {
              await dispatchBackspace();
              await sleep(jitteredDelay(scaledBase * 0.45, 0.3));
            }
            for (const c of pendingCorrection.correctBuffer) {
              await dispatchChar(c);
              await sleep(jitteredDelay(scaledBase, variability));
            }
            pendingCorrection = null;
          } else {
            pendingCorrection.countdown--;
            if (ch !== '\n' && ch !== '\r') {
              pendingCorrection.correctBuffer.push(ch);
            }
          }
        }

        burstRem--;
        i++;

        if (onProgress) onProgress(i / text.length, i, text.length);

        // Drift-corrected delay
        const elapsed = Date.now() - startTime;
        const theoretical = (i / text.length) * targetMs;
        const drift = elapsed - theoretical;
        const rawDelay = jitteredDelay(scaledBase * (inBurst ? 0.7 : 1.0), variability);
        await sleep(Math.max(10, rawDelay - drift));
      }
    } finally {
      await cdpDetach();
      this.isRunning = false;
      this.isPaused = false;
      if (onProgress && !this._stopRequested) {
        onProgress(1, text.length, text.length);
      }
    }
  }

  pause() {
    if (this.isRunning) this.isPaused = true;
  }

  resume() {
    if (this.isRunning) this.isPaused = false;
  }

  stop() {
    this._stopRequested = true;
    this.isPaused = false;
    this.isRunning = false;
  }

  getStatus() {
    return { isRunning: this.isRunning, isPaused: this.isPaused };
  }
}

window.typingSimulator = new TypingSimulator();
window.isDocEditable = isDocEditable;
