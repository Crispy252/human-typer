/**
 * Phantom — Typing Simulator v1.3.0
 * Simulates deeply realistic human typing using Chrome Debugger Protocol (CDP).
 *
 * CDP events are browser-trusted — Google Docs, Canvas, and Blackboard respond
 * to them. Synthetic JS events (isTrusted:false) are ignored by all of these.
 *
 * Engine features:
 *  ✦ Poisson burst model — natural typing rhythm with burst/pause cycles
 *  ✦ CLT-jittered inter-keystroke delays + drift correction
 *  ✦ Fatigue Curve — speed gradually decays over long sessions (Pro)
 *  ✦ Sentence Intelligence — pauses after . ? ! like a real thinker
 *  ✦ Smart Error Zones — typos cluster in the middle of words (Pro)
 *  ✦ Stealth Mode — extra micro-pauses to beat keystroke analysis (Pro)
 *  ✦ Resume from Interruption — picks up where it left off
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

/**
 * Fatigue multiplier — simulates natural speed decay over a long session.
 * At progress=0 (start): multiplier = 1.0 (full speed)
 * At progress=1 (end):   multiplier = 1 + fatigueFactor (slower by that factor)
 * Uses a gentle exponential curve so the slowdown feels natural, not linear.
 * @param {number} progress - 0→1 fraction of text typed so far
 * @param {number} fatigueFactor - how much slower by the end (e.g. 0.35 = 35% slower)
 */
function fatigueMultiplier(progress, fatigueFactor) {
  // Exponential curve: fast at start, progressively slower
  return 1 + fatigueFactor * (Math.exp(progress * 2) - 1) / (Math.exp(2) - 1);
}

/**
 * Sentence-end pause duration after . ? !
 * Returns 0 if not a sentence boundary, otherwise a realistic thinking pause.
 * @param {string} text - the full text
 * @param {number} i    - current character index (the char just typed)
 */
function sentencePause(text, i) {
  const ch = text[i];
  if (ch !== '.' && ch !== '?' && ch !== '!') return 0;
  // Only pause if the next non-whitespace character starts a new sentence
  const nextCh = text[i + 1];
  if (!nextCh || nextCh === '\n') return 0; // handled by newline pause
  if (nextCh === ' ' || nextCh === '\r') {
    // Pause 250–900 ms to simulate thinking about the next sentence
    return 250 + Math.random() * 650;
  }
  return 0;
}

/**
 * Smart Error Zone multiplier — typos are more likely in the middle of a word.
 * Position 0-1 (start/end): 0.3× base typo rate
 * Position ~0.5 (middle):   1.8× base typo rate
 * Models real keyboard errors: fingers are most uncertain mid-reach.
 * @param {number} wordPos - 0→1 position within the current word (0=first char, 1=last)
 */
function smartErrorZoneMultiplier(wordPos) {
  // Bell curve peaking at 0.5
  const x = (wordPos - 0.5) * 4; // scale to ±2 std devs
  return 0.3 + 1.5 * Math.exp(-0.5 * x * x);
}

function isDocEditable() {
  return !!(
    document.querySelector('.docs-texteventtarget-iframe') ||
    document.querySelector('.kix-appview-editor')
  );
}

// ── Resume state helpers ───────────────────────────────────────────────────────
// Uses chrome.storage.session so the resume offer disappears when Chrome restarts.
// Falls back to chrome.storage.local if session is unavailable (older Chrome builds).

const _resumeStorage = (chrome.storage.session) ? chrome.storage.session : chrome.storage.local;
const RESUME_KEY = '_phantomResume';

function saveResumeState(state) {
  // state = { text, resumeFrom, settings, timestamp }
  _resumeStorage.set({ [RESUME_KEY]: state });
}

function loadResumeState() {
  return new Promise(resolve => {
    _resumeStorage.get([RESUME_KEY], (data) => resolve(data[RESUME_KEY] || null));
  });
}

function clearResumeState() {
  _resumeStorage.remove(RESUME_KEY);
}

// ─── Chrome Debugger API bridge ───────────────────────────────────────────────
// All input goes through the background script via Chrome Debugger Protocol.
// CDP events are trusted — Google Docs responds to them, unlike synthetic
// JS events which have isTrusted:false and are ignored.

function bgSend(msg) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
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
  // Non-printable keys must use 'keyDown' (not 'rawKeyDown').
  // rawKeyDown is the pre-char phase for printable keys — Google Docs processes
  // Backspace from the keydown handler, which rawKeyDown does NOT trigger.
  const base = { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8,
                 modifiers: 0, autoRepeat: false, isKeypad: false, isSystemKey: false };
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params: { ...base, type: 'keyDown' } });
  await sleep(32); // Docs needs a moment between keyDown and keyUp to register the deletion
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params: { ...base, type: 'keyUp' } });
}

async function dispatchEnter() {
  const base = { key: 'Enter', text: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
                 modifiers: 0, autoRepeat: false, isKeypad: false, isSystemKey: false };
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params: { ...base, type: 'rawKeyDown' } });
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params: { ...base, type: 'char' } });
  await bgSend({ type: 'DEBUGGER_KEY_EVENT', params: { ...base, type: 'keyUp' } });
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
    this.isRunning   = false;
    this.isPaused    = false;
    this._stopRequested = false;
    this._resumeFrom    = 0; // character index to start from (for Resume feature)
  }

  /**
   * Start typing the given text over the specified duration.
   *
   * @param {string}   text        — Text to type
   * @param {object}   settings    — {
   *   durationMinutes,
   *   variability (0-1),
   *   typoRate (0-1),
   *   stealthMode (bool, Pro),
   *   fatigueCurve (bool, Pro)  — speed decays naturally over session,
   *   smartErrorZones (bool, Pro) — typos cluster in the middle of words,
   *   resumeFrom (number)       — character index to resume from (0 = start)
   * }
   * @param {function} onProgress — (fraction, charsTyped, total) — fraction=-1 = error
   * @param {function} onStatus   — (message) — status updates for the panel
   * @returns {Promise<void>}
   */
  async start(text, settings, onProgress, onStatus) {
    if (this.isRunning) return;

    const status = (msg) => {
      console.log('[Phantom]', msg);
      if (onStatus) onStatus(msg);
    };

    this.isRunning      = true;
    this.isPaused       = false;
    this._stopRequested = false;

    const {
      durationMinutes,
      variability     = 0.4,
      typoRate        = 0.03,
      stealthMode     = false,
      fatigueCurve    = false,
      smartErrorZones = false,
      resumeFrom      = 0,
    } = settings;

    const targetMs = durationMinutes * 60 * 1000;

    // When resuming, only the remaining text drives our timing budget.
    const remainingText = text.slice(resumeFrom);
    const roughBase = targetMs / Math.max(remainingText.length, 1);
    const estimated = estimateTotalTime(remainingText, roughBase, variability, typoRate);
    const scale      = targetMs / Math.max(estimated, 1);
    const scaledBase = roughBase * scale;

    // Attach the Chrome Debugger — this is what makes typing work
    status('Attaching debugger…');
    const attachResult = await cdpAttach();
    if (!attachResult.success) {
      const reason = attachResult.error || 'unknown error';
      status(`❌ ${reason}. Close DevTools on this tab, then reload the extension and try again.`);
      this.isRunning = false;
      if (onProgress) onProgress(-1, 0, text.length);
      return;
    }

    // Cursor position is already set — the UI countdown instructed the user to click
    // in the document before typing begins. Do NOT CDP-click here; that would move
    // the cursor to the canvas center, overriding where the user positioned it.
    const startMsg = resumeFrom > 0
      ? `Resuming from character ${resumeFrom.toLocaleString()} of ${text.length.toLocaleString()}…`
      : `Starting — ${text.length.toLocaleString()} characters over ${durationMinutes} min…`;
    status(startMsg);

    let burstRem = randomBurstLength();
    let i = resumeFrom;

    // pendingCorrection = { charsLeft: number, toRetype: string[] }
    //   charsLeft — additional chars to type before noticing the typo
    //   toRetype  — [correct_char, subsequent_chars…] to retype after backspacing
    let pendingCorrection = null;
    const startTime = Date.now();

    // Word-position tracking for Smart Error Zones
    let wordStart = resumeFrom; // index of first char in current word

    // Save resume state every N characters so an interrupted session can pick up
    let lastSaveAt = resumeFrom;
    const SAVE_INTERVAL = 15; // save every 15 chars (low overhead)

    try {
      while (i < text.length) {
        if (this._stopRequested) break;

        while (this.isPaused) {
          // Save resume state when paused so the user can resume later
          saveResumeState({ text, resumeFrom: i, settings, timestamp: Date.now() });
          await sleep(100);
          if (this._stopRequested) break;
        }
        if (this._stopRequested) break;

        // ── Correct a pending typo BEFORE typing the next char ──────────────
        if (pendingCorrection && pendingCorrection.charsLeft === 0) {
          await sleep(jitteredDelay(400, 0.3)); // human notices mistake ~400 ms
          for (let b = 0; b < pendingCorrection.toRetype.length; b++) {
            await dispatchBackspace();
            await sleep(jitteredDelay(90, 0.3));
          }
          for (const c of pendingCorrection.toRetype) {
            if (c === '\n') await dispatchEnter();
            else await dispatchChar(c);
            await sleep(jitteredDelay(60, variability));
          }
          pendingCorrection = null;
        }

        // ── Burst transition — thinking pause ────────────────────────────────
        if (burstRem === 0) {
          const thinkMs = (300 + Math.random() * 1200) * scale;
          await sleep(thinkMs);
          burstRem = randomBurstLength();
        }

        const ch = text[i];
        const inBurst = burstRem > 0;

        // ── Track word position for Smart Error Zones ────────────────────────
        if (ch === ' ' || ch === '\n' || ch === '\r') {
          wordStart = i + 1; // next char starts a new word
        }
        // How far into the current word are we? (0 = first char, 1 = last known)
        const wordLen     = i - wordStart + 1;
        // Look ahead to find full word length (cap at 20 to stay cheap)
        let fullWordLen = wordLen;
        for (let k = i + 1; k < Math.min(i + 20, text.length); k++) {
          if (text[k] === ' ' || text[k] === '\n') break;
          fullWordLen++;
        }
        const wordPos = fullWordLen > 1 ? (wordLen - 1) / (fullWordLen - 1) : 0;

        // ── Effective typo rate (optionally modulated by word position) ───────
        const effectiveTypoRate = smartErrorZones
          ? typoRate * smartErrorZoneMultiplier(wordPos)
          : typoRate;

        // ── Fatigue: slower as the session progresses (Pro) ──────────────────
        const progress  = (i - resumeFrom) / Math.max(remainingText.length, 1);
        const fatigue   = fatigueCurve ? fatigueMultiplier(progress, 0.35) : 1.0;
        const burstFactor = inBurst ? 0.7 : 1.0;
        const effectiveBase = scaledBase * burstFactor * fatigue;

        // ── Type the current character ───────────────────────────────────────
        if (ch === '\n') {
          await dispatchEnter();
          if (pendingCorrection) {
            pendingCorrection.charsLeft--;
            pendingCorrection.toRetype.push('\n');
          }
        } else if (ch === '\r') {
          // skip carriage returns
        } else if (!pendingCorrection && Math.random() < effectiveTypoRate) {
          // Inject a typo — type the wrong adjacent key and schedule correction
          const wrongChar = getAdjacentKey(ch);
          if (wrongChar) {
            await dispatchChar(wrongChar);
            await sleep(jitteredDelay(effectiveBase, variability));
            pendingCorrection = {
              charsLeft: Math.floor(Math.random() * 5), // notice after 0–4 more chars
              toRetype: [ch],
            };
          } else {
            await dispatchChar(ch); // no adjacent key available; type correctly
          }
        } else {
          await dispatchChar(ch);
          if (pendingCorrection) {
            pendingCorrection.charsLeft--;
            pendingCorrection.toRetype.push(ch);
          }
        }

        burstRem--;
        i++;

        if (onProgress) onProgress(i / text.length, i, text.length);

        // ── Sentence Intelligence — pause after . ? ! ────────────────────────
        const sPause = sentencePause(text, i - 1);
        if (sPause > 0) await sleep(sPause * scale);

        // ── Stealth mode — extra anti-detection pauses (Pro) ─────────────────
        if (stealthMode) {
          if (ch === '\n') {
            // Simulate reading what was just typed after each paragraph
            await sleep(800 + Math.random() * 2000);
          }
          // Random micro-hesitation inside a burst (~6% chance, 100–450 ms)
          if (inBurst && Math.random() < 0.06) {
            await sleep(100 + Math.random() * 350);
          }
        }

        // ── Drift-corrected inter-keystroke delay ────────────────────────────
        const elapsed     = Date.now() - startTime;
        const theoretical = ((i - resumeFrom) / remainingText.length) * targetMs;
        const drift       = elapsed - theoretical;
        const rawDelay    = jitteredDelay(effectiveBase, variability);
        await sleep(Math.max(10, rawDelay - drift));

        // ── Periodic resume-state save ───────────────────────────────────────
        if (i - lastSaveAt >= SAVE_INTERVAL) {
          saveResumeState({ text, resumeFrom: i, settings, timestamp: Date.now() });
          lastSaveAt = i;
        }
      }
    } finally {
      await cdpDetach();
      this.isRunning = false;
      this.isPaused  = false;

      if (this._stopRequested) {
        // Keep resume state intact so user can resume later
      } else {
        // Session completed — clear resume state
        clearResumeState();
        if (onProgress) onProgress(1, text.length, text.length);
      }
    }
  }

  pause()  { if (this.isRunning) this.isPaused = true; }
  resume() { if (this.isRunning) this.isPaused = false; }

  stop() {
    this._stopRequested = true;
    this.isPaused = false;
    this.isRunning = false;
  }

  getStatus() {
    return { isRunning: this.isRunning, isPaused: this.isPaused };
  }
}

// ─── Session / paywall helpers ───────────────────────────────────────────────
// State lives in chrome.storage.local so it persists across tabs and reloads.
// Schema: { sessionsToday, lastResetDate, isPro, licenseKey, savedPresets }

/**
 * Check whether the current user is allowed to start a new session.
 * Pro users: always allowed.
 * Free users: allowed when sessionsToday < 3 (resets daily).
 * @returns {Promise<{ allowed: boolean, isPro: boolean, sessionsToday: number }>}
 */
async function checkSessionAllowed() {
  return new Promise(resolve => {
    chrome.storage.local.get(['sessionsToday', 'lastResetDate', 'tier', 'isPro'], (data) => {
      // Backward compat: old installs used isPro:true
      const tier = data.tier || (data.isPro ? 'pro' : 'free');
      if (tier !== 'free') return resolve({ allowed: true, tier, sessionsToday: -1 });
      const today = new Date().toISOString().slice(0, 10);
      const sessionsToday = (data.lastResetDate === today) ? (data.sessionsToday || 0) : 0;
      resolve({ allowed: sessionsToday < 3, tier: 'free', sessionsToday });
    });
  });
}

/**
 * Increment the session counter for today.
 * Resets the count automatically when the date changes.
 * @returns {Promise<void>}
 */
async function incrementSession() {
  return new Promise(resolve => {
    const today = new Date().toISOString().slice(0, 10);
    chrome.storage.local.get(['sessionsToday', 'lastResetDate'], (data) => {
      const sessionsToday = (data.lastResetDate === today) ? (data.sessionsToday || 0) : 0;
      chrome.storage.local.set({ sessionsToday: sessionsToday + 1, lastResetDate: today }, resolve);
    });
  });
}
// ─────────────────────────────────────────────────────────────────────────────

window.typingSimulator    = new TypingSimulator();
window.isDocEditable      = isDocEditable;
window.checkSessionAllowed = checkSessionAllowed;
window.incrementSession   = incrementSession;
window.loadResumeState    = loadResumeState;
window.clearResumeState   = clearResumeState;
window.saveResumeState    = saveResumeState;
