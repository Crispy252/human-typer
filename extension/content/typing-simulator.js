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
// All input goes through the background script via Chrome Debugger Protocol.
// CDP events are trusted — Google Docs responds to them, unlike synthetic
// JS events which have isTrusted:false and are ignored.

function bgSend(msg) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[TypingSimulator] sendMessage error:', chrome.runtime.lastError.message);
        // Retry once — service worker may have been sleeping
        setTimeout(() => {
          chrome.runtime.sendMessage(msg, resolve);
        }, 500);
      } else {
        resolve(response);
      }
    });
  });
}

async function cdpAttach() {
  const res = await bgSend({ type: 'DEBUGGER_ATTACH' });
  console.log('[TypingSimulator] cdpAttach result:', res);
  if (!res) return { success: false, error: 'No response from background script' };
  return res;
}

async function cdpDetach() {
  await bgSend({ type: 'DEBUGGER_DETACH' });
}

// Returns the Windows Virtual Key code for a character.
function vkCode(ch) {
  const upper = ch.toUpperCase();
  if (upper >= 'A' && upper <= 'Z') return upper.charCodeAt(0);  // 65-90
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0);           // 48-57
  if (ch === ' ') return 32;
  // Special shifted chars — return the base key VK
  const shiftMap = { '!':49,'@':50,'#':51,'$':52,'%':53,'^':54,'&':55,'*':56,'(':57,')':48,
                     '_':189,'+':187,'{':219,'}':221,'|':220,':':186,'"':222,'<':188,'>':190,'?':191,'~':192 };
  if (shiftMap[ch] !== undefined) return shiftMap[ch];
  return ch.charCodeAt(0);
}

// Whether a character needs the Shift modifier
function needsShift(ch) {
  if (ch >= 'A' && ch <= 'Z') return true;
  return '!@#$%^&*()_+{}|:"<>?~'.includes(ch);
}

// Dispatch a printable character via the rawKeyDown → char → keyUp CDP sequence.
// This goes through the browser's normal keyboard pipeline — Google Docs responds to it.
async function dispatchChar(ch) {
  const vk = vkCode(ch);
  const modifiers = needsShift(ch) ? 8 : 0; // 8 = Shift
  const base = {
    key: ch,
    text: ch,
    unmodifiedText: ch.toLowerCase(),
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
    modifiers,
    autoRepeat: false,
    isKeypad: false,
    isSystemKey: false,
  };
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params: { ...base, type: 'rawKeyDown' } });
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params: { ...base, type: 'char' } });
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params: { ...base, type: 'keyUp' } });
}

async function dispatchBackspace() {
  const base = { key: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8,
                 modifiers: 0, autoRepeat: false, isKeypad: false, isSystemKey: false };
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params: { ...base, type: 'rawKeyDown' } });
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params: { ...base, type: 'keyUp' } });
}

async function dispatchEnter() {
  const base = { key: 'Enter', text: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
                 modifiers: 0, autoRepeat: false, isKeypad: false, isSystemKey: false };
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params: { ...base, type: 'rawKeyDown' } });
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params: { ...base, type: 'char' } });
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params: { ...base, type: 'keyUp' } });
}

// Click the Google Docs canvas via CDP to ensure it has focus before typing.
async function cdpFocusDoc() {
  const canvas = document.querySelector('.kix-appview-editor') ||
                 document.querySelector('.kix-canvas-tile-content');
  let x, y;
  if (canvas) {
    const r = canvas.getBoundingClientRect();
    x = Math.round(r.left + r.width / 2);
    y = Math.round(r.top + r.height / 2);
  } else {
    x = Math.round(window.innerWidth / 2);
    y = Math.round(window.innerHeight * 0.4);
  }
  const base = { x, y, button: 'left', clickCount: 1, modifiers: 0 };
  await bgSend({ type: 'DEBUGGER_MOUSE_EVENT', params: { ...base, type: 'mousePressed', buttons: 1 } });
  await bgSend({ type: 'DEBUGGER_MOUSE_EVENT', params: { ...base, type: 'mouseReleased', buttons: 0 } });
  console.log('[TypingSimulator] cdpFocusDoc clicked at', x, y);
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
   * @param {function} onProgress - Callback: (fraction, charsTyped, total) — fraction=-1 means error
   * @param {function} onStatus   - Callback: (message) — shows step-by-step status in the panel
   * @returns {Promise<void>}
   */
  async start(text, settings, onProgress, onStatus) {
    if (this.isRunning) return;

    const status = (msg) => {
      console.log('[TypingSimulator]', msg);
      if (onStatus) onStatus(msg);
    };

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
    status('Attaching debugger...');
    const attachResult = await cdpAttach();
    if (!attachResult.success) {
      const reason = attachResult.error || 'unknown error';
      status(`ERROR: ${reason}. Close DevTools on this tab, then reload the extension and try again.`);
      this.isRunning = false;
      if (onProgress) onProgress(-1, 0, text.length);
      return;
    }
    status('Debugger attached. Clicking doc to set focus...');

    // Click the canvas to ensure Google Docs has keyboard focus
    await cdpFocusDoc();
    await sleep(200);
    status(`Starting to type ${text.length} characters over ${durationMinutes} min...`);

    let burstRem = randomBurstLength();
    let i = 0;
    // pendingCorrection = { charsLeft: number, toRetype: string[] }
    //   charsLeft  — how many more chars to type before noticing the typo
    //   toRetype   — [correct_typo_char, subsequent_char1, ...] to retype after backspacing
    // The wrong char is always already in the doc; toRetype tracks what to put back.
    let pendingCorrection = null;
    const startTime = Date.now();

    try {
      while (i < text.length) {
        if (this._stopRequested) break;

        while (this.isPaused) {
          await sleep(100);
          if (this._stopRequested) break;
        }
        if (this._stopRequested) break;

        // ── Correct a pending typo BEFORE typing the next char ──────────────
        // This fires when charsLeft reaches 0 (set at end of previous iteration).
        if (pendingCorrection && pendingCorrection.charsLeft === 0) {
          await sleep(jitteredDelay(scaledBase * 1.5, 0.3)); // pause: human notices mistake
          // toRetype contains [typo_char, char1, char2, …] — each maps 1:1 to a char
          // in the doc (wrong_char, char1, char2, …), so delete exactly toRetype.length chars.
          for (let b = 0; b < pendingCorrection.toRetype.length; b++) {
            await dispatchBackspace();
            await sleep(jitteredDelay(scaledBase * 0.45, 0.3));
          }
          for (const c of pendingCorrection.toRetype) {
            if (c === '\n') await dispatchEnter();
            else await dispatchChar(c);
            await sleep(jitteredDelay(scaledBase, variability));
          }
          pendingCorrection = null;
        }

        // Burst transition — pause to simulate thinking
        if (burstRem === 0) {
          const thinkMs = (300 + Math.random() * 1200) * scale;
          await sleep(thinkMs);
          burstRem = randomBurstLength();
        }

        const ch = text[i];
        const inBurst = burstRem > 0;

        // ── Type the current character ───────────────────────────────────────
        if (ch === '\n') {
          await dispatchEnter();
          if (pendingCorrection) {
            pendingCorrection.charsLeft--;
            pendingCorrection.toRetype.push('\n');
          }
        } else if (ch === '\r') {
          // skip carriage returns
        } else if (!pendingCorrection && Math.random() < typoRate) {
          // Inject a typo: type the wrong adjacent key, note correct char for later
          const wrongChar = getAdjacentKey(ch);
          if (wrongChar) {
            await dispatchChar(wrongChar);
            await sleep(jitteredDelay(scaledBase * (inBurst ? 0.7 : 1.0), variability));
            // charsLeft = how many chars to type before noticing (0 = notice immediately next iter)
            pendingCorrection = {
              charsLeft: Math.floor(Math.random() * 5), // 0..4
              toRetype: [ch],                            // ch is what belongs here
            };
          } else {
            await dispatchChar(ch); // no adjacent key, type correctly
          }
        } else {
          await dispatchChar(ch);
          // Track this char so it can be retyped during correction
          if (pendingCorrection) {
            pendingCorrection.charsLeft--;
            pendingCorrection.toRetype.push(ch);
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
