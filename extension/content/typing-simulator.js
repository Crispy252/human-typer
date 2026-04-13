/**
 * Google Docs Typing Simulator
 * Simulates realistic human typing with variable speed, mistakes, and corrections.
 * Exported as window.typingSimulator for use by ui-injector.js
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

/**
 * Returns { target, doc } pointing at Google Docs' hidden keyboard input proxy.
 * Docs routes all keyboard input through a textarea inside .docs-texteventtarget-iframe.
 * Dispatching events there (and calling execCommand on its document) is the only
 * reliable way to inject text programmatically.
 */
function getEditorContext() {
  const iframe = document.querySelector('.docs-texteventtarget-iframe');
  if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
    return { target: iframe.contentDocument.body, doc: iframe.contentDocument };
  }
  // Fallback for older Docs layouts
  const el = document.querySelector('.kix-appview-editor') ||
             document.querySelector('[contenteditable="true"]') ||
             document.querySelector('.kix-canvas') ||
             document.body;
  return { target: el, doc: document };
}

function isDocEditable() {
  return !!(
    document.querySelector('.docs-texteventtarget-iframe') ||
    document.querySelector('.kix-appview-editor')
  );
}

function focusEditor(ctx) {
  ctx.target.click();
  ctx.target.focus();
}

async function dispatchChar(ch, ctx) {
  const { target, doc } = ctx;
  const code = ch.toUpperCase().charCodeAt(0);

  target.dispatchEvent(new KeyboardEvent('keydown', {
    key: ch, code: `Key${ch.toUpperCase()}`,
    keyCode: code, which: code,
    bubbles: true, cancelable: true, composed: true
  }));

  target.dispatchEvent(new KeyboardEvent('keypress', {
    key: ch, charCode: ch.charCodeAt(0),
    keyCode: code, which: code,
    bubbles: true, cancelable: true, composed: true
  }));

  const success = doc.execCommand('insertText', false, ch);
  if (!success) {
    try {
      target.dispatchEvent(new TextEvent('textInput', {
        bubbles: true, cancelable: true, data: ch
      }));
    } catch (_) {
      // TextEvent not supported in all browsers
    }
  }

  target.dispatchEvent(new KeyboardEvent('keyup', {
    key: ch, code: `Key${ch.toUpperCase()}`,
    keyCode: code, which: code,
    bubbles: true, cancelable: true, composed: true
  }));
}

async function dispatchBackspace(ctx) {
  const { target, doc } = ctx;
  const opts = {
    key: 'Backspace', code: 'Backspace',
    keyCode: 8, which: 8,
    bubbles: true, cancelable: true, composed: true
  };
  target.dispatchEvent(new KeyboardEvent('keydown', opts));
  doc.execCommand('delete', false);
  target.dispatchEvent(new KeyboardEvent('keyup', opts));
}

async function dispatchEnter(ctx) {
  const { target, doc } = ctx;
  const opts = {
    key: 'Enter', code: 'Enter',
    keyCode: 13, which: 13,
    bubbles: true, cancelable: true, composed: true
  };
  target.dispatchEvent(new KeyboardEvent('keydown', opts));
  doc.execCommand('insertParagraph', false);
  target.dispatchEvent(new KeyboardEvent('keyup', opts));
}

// Estimate total typing time for a given text and settings (used for pacing)
function estimateTotalTime(text, baseDelayMs, variability, typoRate) {
  let total = 0;
  let burstRem = randomBurstLength();
  for (let i = 0; i < text.length; i++) {
    if (burstRem === 0) {
      total += 800; // avg thinking pause between bursts
      burstRem = randomBurstLength();
    }
    const burstFactor = burstRem > 0 ? 0.7 : 1.0;
    total += baseDelayMs * burstFactor;
    burstRem--;
    if (Math.random() < typoRate) {
      // Typo overhead: wrong char + notice delay (avg 2) + backspaces + retype
      total += baseDelayMs * 6;
    }
  }
  return total;
}

class TypingSimulator {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this._stopRequested = false;
    this._onProgress = null;
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
    this._onProgress = onProgress || null;

    const { durationMinutes, variability = 0.4, typoRate = 0.03 } = settings;
    const targetMs = durationMinutes * 60 * 1000;

    // Base delay assuming uniform typing (no bursts/typos yet)
    const roughBase = targetMs / text.length;

    // Estimate actual time including burst pauses and typo overhead
    const estimated = estimateTotalTime(text, roughBase, variability, typoRate);
    const scale = targetMs / Math.max(estimated, 1);
    const scaledBase = roughBase * scale;

    const ctx = getEditorContext();
    focusEditor(ctx);

    let burstRem = randomBurstLength();
    let i = 0;
    // State for pending typo correction
    // { countdown: number, correctBuffer: string[] }
    let pendingCorrection = null;
    const startTime = Date.now();

    while (i < text.length) {
      if (this._stopRequested) break;

      // Pause loop
      while (this.isPaused) {
        await sleep(100);
        if (this._stopRequested) break;
      }
      if (this._stopRequested) break;

      // Burst transition
      if (burstRem === 0) {
        const thinkMs = (300 + Math.random() * 1200) * scale;
        await sleep(thinkMs);
        burstRem = randomBurstLength();
        // Re-focus after pause in case focus drifted
        focusEditor(ctx);
      }

      const ch = text[i];
      const inBurst = burstRem > 0;

      if (ch === '\n') {
        await dispatchEnter(ctx);
      } else if (ch === '\r') {
        // Skip carriage returns
      } else {
        // Decide whether to inject a typo at this position
        if (!pendingCorrection && Math.random() < typoRate) {
          const wrongChar = getAdjacentKey(ch);
          if (wrongChar) {
            // Type the wrong character
            await dispatchChar(wrongChar, ctx);
            await sleep(jitteredDelay(scaledBase * (inBurst ? 0.7 : 1.0), variability));
            // Notice after 0–4 more characters
            const noticeAfter = Math.floor(Math.random() * 5);
            pendingCorrection = { countdown: noticeAfter, correctBuffer: [ch] };
          } else {
            await dispatchChar(ch, ctx);
          }
        } else {
          await dispatchChar(ch, ctx);
        }
      }

      // Handle pending typo correction
      if (pendingCorrection) {
        if (pendingCorrection.countdown === 0) {
          // Pause briefly before correcting (human notices mistake)
          await sleep(jitteredDelay(scaledBase * 1.5, 0.3));
          // Backspace over wrong char + anything typed after it
          const deleteCount = pendingCorrection.correctBuffer.length + 1;
          for (let b = 0; b < deleteCount; b++) {
            await dispatchBackspace(ctx);
            await sleep(jitteredDelay(scaledBase * 0.45, 0.3));
          }
          // Retype the correct characters
          for (const c of pendingCorrection.correctBuffer) {
            await dispatchChar(c, ctx);
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

      if (this._onProgress) {
        this._onProgress(i / text.length, i, text.length);
      }

      // Drift-corrected delay
      const elapsed = Date.now() - startTime;
      const theoretical = (i / text.length) * targetMs;
      const drift = elapsed - theoretical;
      const rawDelay = jitteredDelay(scaledBase * (inBurst ? 0.7 : 1.0), variability);
      const adjustedDelay = Math.max(10, rawDelay - drift);
      await sleep(adjustedDelay);
    }

    this.isRunning = false;
    this.isPaused = false;
    if (this._onProgress && !this._stopRequested) {
      this._onProgress(1, text.length, text.length);
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
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
    };
  }
}

window.typingSimulator = new TypingSimulator();
window.isDocEditable = isDocEditable;
