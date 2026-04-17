/**
 * Human Typer — UI Injector
 * Injects the floating typing simulator panel into Google Docs pages.
 * Handles freemium session limits, the paywall modal, and Pro presets.
 */

// TODO: Replace with your Gumroad product URL after creating the product.
// Go to gumroad.com → New Product → set price $3 → type "License Key" → name "Human Typer Pro"
// Then copy the product page URL (e.g. https://yourname.gumroad.com/l/human-typer) and paste below.
const GUMROAD_PRODUCT_URL = 'https://gumroad.com'; // TODO: set your Gumroad product URL

const FREE_SESSION_LIMIT = 3;
const FREE_CHAR_LIMIT    = 500;
const PRO_PRESET_LIMIT   = 5;

class UIInjector {
  constructor() {
    this._isPro        = false; // cached after _loadState(); used by minimize handler
    this._isMinimized  = false;
  }

  // ─── Panel injection ────────────────────────────────────────────────────────

  injectTypingSimulatorPanel() {
    if (document.getElementById('sai-typing-panel')) return;
    if (!window.location.href.includes('docs.google.com')) return;
    if (window.isDocEditable && !window.isDocEditable()) return;

    const panel = document.createElement('div');
    panel.id = 'sai-typing-panel';
    panel.className = 'sai-typing-panel';
    panel.innerHTML = `
      <!-- Paywall modal — overlays the panel when a limit is hit -->
      <div class="sai-paywall-modal" id="sai-paywall-modal" style="display:none">
        <div class="sai-paywall-content">
          <div class="sai-paywall-icon">✦</div>
          <div class="sai-paywall-title">Upgrade to Human Typer Pro</div>
          <div class="sai-paywall-reason" id="sai-paywall-reason"></div>
          <ul class="sai-paywall-features">
            <li>✓ Unlimited sessions per day</li>
            <li>✓ Unlimited characters per session</li>
            <li>✓ Save up to 5 text presets</li>
          </ul>
          <a class="sai-paywall-cta" href="${GUMROAD_PRODUCT_URL}" target="_blank" rel="noopener">
            Unlock Pro — $3
          </a>
          <button class="sai-paywall-key-toggle" id="sai-paywall-key-toggle">
            Already have a key?
          </button>
          <div class="sai-paywall-key-form" id="sai-paywall-key-form" style="display:none">
            <input type="text" class="sai-license-input" id="sai-license-input"
                   placeholder="Enter your license key…" autocomplete="off" spellcheck="false">
            <button class="sai-license-verify-btn" id="sai-license-verify">Verify</button>
            <div class="sai-license-status" id="sai-license-status"></div>
          </div>
          <button class="sai-paywall-dismiss" id="sai-paywall-dismiss">Maybe later</button>
        </div>
      </div>

      <!-- Panel header -->
      <div class="sai-typing-panel-header" id="sai-typing-panel-drag">
        <span class="sai-header-title">
          Human Typer
          <span class="sai-pro-badge" id="sai-pro-badge" style="display:none">PRO</span>
        </span>
        <div class="sai-typing-panel-controls">
          <button class="sai-panel-minimize" id="sai-typing-minimize" title="Minimize">&#8722;</button>
          <button class="sai-typing-close"   id="sai-typing-close"   title="Close">&#215;</button>
        </div>
      </div>

      <!-- Session counter bar (Free users only) -->
      <div class="sai-session-bar" id="sai-session-bar" style="display:none">
        Sessions today: <span id="sai-session-count">0</span> / ${FREE_SESSION_LIMIT}
        <button class="sai-upgrade-link" id="sai-session-upgrade">Upgrade</button>
      </div>

      <!-- Panel body -->
      <div class="sai-typing-panel-body" id="sai-typing-body">

        <div class="sai-typing-field-group">
          <label class="sai-typing-label">Text to type</label>
          <textarea class="sai-typing-textarea" id="sai-typing-text"
                    placeholder="Paste your text here…"></textarea>
          <div class="sai-char-counter" id="sai-char-counter" style="display:none">
            <span id="sai-char-count">0</span> / ${FREE_CHAR_LIMIT} characters (free limit)
          </div>
        </div>

        <!-- Presets section (Pro only) -->
        <div class="sai-presets-section" id="sai-presets-section" style="display:none">
          <div class="sai-presets-header">
            <label class="sai-typing-label" style="margin:0">Presets</label>
            <button class="sai-save-preset-btn" id="sai-save-preset">+ Save</button>
          </div>
          <div class="sai-presets-list" id="sai-presets-list"></div>
        </div>

        <div class="sai-typing-field-inline">
          <label class="sai-typing-label" style="margin:0">Duration (minutes)</label>
          <input type="number" class="sai-typing-number-input" id="sai-typing-duration"
                 value="5" min="0.5" max="120" step="0.5">
        </div>
        <div class="sai-typing-field-group">
          <label class="sai-typing-label">
            Speed variability: <span id="sai-variability-val">40%</span>
          </label>
          <input type="range" class="sai-typing-slider" id="sai-typing-variability"
                 min="0" max="100" value="40">
        </div>
        <div class="sai-typing-field-group">
          <label class="sai-typing-label">
            Typo rate: <span id="sai-typo-val">3%</span>
          </label>
          <input type="range" class="sai-typing-slider" id="sai-typing-typo"
                 min="0" max="15" value="3">
        </div>
        <div class="sai-typing-progress-section" id="sai-typing-progress-section" style="display:none">
          <div class="sai-typing-progress-bar">
            <div class="sai-typing-progress-fill" id="sai-typing-progress-fill"></div>
          </div>
          <div class="sai-typing-stats" id="sai-typing-stats">0 / 0 characters</div>
        </div>
        <div class="sai-typing-buttons">
          <button class="sai-btn-start" id="sai-typing-start">Start</button>
          <button class="sai-btn-pause" id="sai-typing-pause" disabled>Pause</button>
          <button class="sai-btn-stop"  id="sai-typing-stop"  disabled>Stop</button>
        </div>

      </div>
    `;

    document.body.appendChild(panel);
    this._bindTypingPanelEvents(panel);
    this._loadState();
  }

  // ─── State helpers ──────────────────────────────────────────────────────────

  /** Read storage and refresh all Pro/Free UI elements. */
  _loadState() {
    chrome.storage.local.get(
      ['sessionsToday', 'lastResetDate', 'isPro', 'savedPresets'],
      (data) => {
        const today        = new Date().toISOString().slice(0, 10);
        const isPro        = !!data.isPro;
        const sessionsToday = (data.lastResetDate === today) ? (data.sessionsToday || 0) : 0;
        const presets      = data.savedPresets || [];
        this._applyProState(isPro, sessionsToday, presets);
      }
    );
  }

  /** Apply Pro/Free visual state to every relevant element. */
  _applyProState(isPro, sessionsToday, presets) {
    this._isPro = isPro;
    const el = (id) => document.getElementById(id);

    if (isPro) {
      if (el('sai-pro-badge'))       el('sai-pro-badge').style.display       = 'inline-block';
      if (el('sai-session-bar'))     el('sai-session-bar').style.display     = 'none';
      if (el('sai-char-counter'))    el('sai-char-counter').style.display    = 'none';
      if (el('sai-presets-section')) el('sai-presets-section').style.display = 'block';
      this._renderPresets(presets);
    } else {
      if (el('sai-pro-badge'))       el('sai-pro-badge').style.display       = 'none';
      if (el('sai-session-bar'))     el('sai-session-bar').style.display     = 'flex';
      if (el('sai-session-count'))   el('sai-session-count').textContent     = sessionsToday;
      if (el('sai-char-counter'))    el('sai-char-counter').style.display    = 'block';
      if (el('sai-presets-section')) el('sai-presets-section').style.display = 'none';
      // Initialise the char count display
      const ta = el('sai-typing-text');
      this._updateCharCount(ta ? ta.value.length : 0);
    }
  }

  /** Render the presets list for Pro users. */
  _renderPresets(presets) {
    const list = document.getElementById('sai-presets-list');
    if (!list) return;

    if (!presets || presets.length === 0) {
      list.innerHTML = '<div class="sai-presets-empty">No presets saved yet.</div>';
      return;
    }

    list.innerHTML = presets.map((p, i) => `
      <div class="sai-preset-item">
        <button class="sai-preset-load" data-index="${i}">${this._esc(p.name)}</button>
        <button class="sai-preset-delete" data-index="${i}" title="Delete preset">&#215;</button>
      </div>
    `).join('');

    list.querySelectorAll('.sai-preset-load').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        chrome.storage.local.get(['savedPresets'], (data) => {
          const ps = data.savedPresets || [];
          const ta = document.getElementById('sai-typing-text');
          if (ta && ps[idx]) {
            ta.value = ps[idx].text;
            this._updateCharCount(ta.value.length);
          }
        });
      });
    });

    list.querySelectorAll('.sai-preset-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        chrome.storage.local.get(['savedPresets'], (data) => {
          const ps = (data.savedPresets || []).filter((_, i) => i !== idx);
          chrome.storage.local.set({ savedPresets: ps }, () => this._renderPresets(ps));
        });
      });
    });
  }

  _updateCharCount(len) {
    const el = document.getElementById('sai-char-count');
    if (el) el.textContent = len;
  }

  _esc(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Paywall ────────────────────────────────────────────────────────────────

  _showPaywall(reason) {
    const el = (id) => document.getElementById(id);
    if (el('sai-paywall-reason'))  el('sai-paywall-reason').textContent  = reason;
    // Reset the key form to a clean state each time
    if (el('sai-paywall-key-form'))  el('sai-paywall-key-form').style.display = 'none';
    if (el('sai-license-input'))     el('sai-license-input').value         = '';
    if (el('sai-license-status')) {
      el('sai-license-status').textContent = '';
      el('sai-license-status').className   = 'sai-license-status';
    }
    if (el('sai-paywall-modal'))   el('sai-paywall-modal').style.display  = 'flex';
  }

  _hidePaywall() {
    const el = document.getElementById('sai-paywall-modal');
    if (el) el.style.display = 'none';
  }

  // ─── Events ─────────────────────────────────────────────────────────────────

  _bindTypingPanelEvents(panel) {
    const sim = window.typingSimulator;

    const el  = (id) => document.getElementById(id);
    const set = (id, prop, val) => { const e = el(id); if (e) e[prop] = val; };
    const updateStats = (msg) => { if (el('sai-typing-stats')) el('sai-typing-stats').textContent = msg; };

    const resetButtons = () => {
      set('sai-typing-start', 'disabled', false);
      set('sai-typing-pause', 'disabled', true);
      set('sai-typing-stop',  'disabled', true);
      set('sai-typing-pause', 'textContent', 'Pause');
    };

    // Slider labels
    el('sai-typing-variability').addEventListener('input', (e) => {
      set('sai-variability-val', 'textContent', e.target.value + '%');
    });
    el('sai-typing-typo').addEventListener('input', (e) => {
      set('sai-typo-val', 'textContent', e.target.value + '%');
    });

    // Character counter (Free users)
    el('sai-typing-text').addEventListener('input', (e) => {
      this._updateCharCount(e.target.value.length);
    });

    // ── Start ──────────────────────────────────────────────────────────────────
    el('sai-typing-start').addEventListener('click', async () => {
      const text = el('sai-typing-text') ? el('sai-typing-text').value : '';
      if (!text.trim()) {
        alert('Please paste some text before starting.');
        return;
      }

      // Enforce free-tier limits before starting
      const sessionCheck = await window.checkSessionAllowed();
      if (!sessionCheck.isPro) {
        if (!sessionCheck.allowed) {
          this._showPaywall(
            `You've used all ${FREE_SESSION_LIMIT} free sessions for today. ` +
            `Come back tomorrow or upgrade for unlimited sessions.`
          );
          return;
        }
        if (text.length > FREE_CHAR_LIMIT) {
          this._showPaywall(
            `Your text is ${text.length.toLocaleString()} characters. ` +
            `Free sessions are limited to ${FREE_CHAR_LIMIT} characters. ` +
            `Upgrade for unlimited length.`
          );
          return;
        }
      }

      // Consume one session slot, then refresh the counter
      await window.incrementSession();
      chrome.storage.local.get(['sessionsToday', 'lastResetDate'], (data) => {
        const today = new Date().toISOString().slice(0, 10);
        const count = (data.lastResetDate === today) ? (data.sessionsToday || 0) : 0;
        if (el('sai-session-count')) el('sai-session-count').textContent = count;
      });

      const durationMinutes = parseFloat(el('sai-typing-duration').value) || 5;
      const variability     = parseInt(el('sai-typing-variability').value, 10) / 100;
      const typoRate        = parseInt(el('sai-typing-typo').value, 10) / 100;

      if (el('sai-typing-progress-section')) el('sai-typing-progress-section').style.display = 'block';
      set('sai-typing-start', 'disabled', true);
      set('sai-typing-pause', 'disabled', true);
      set('sai-typing-stop',  'disabled', true);
      if (el('sai-typing-progress-fill')) el('sai-typing-progress-fill').style.width = '0%';

      let count = 3;
      updateStats(`Click in your doc — starting in ${count}...`);

      const ticker = setInterval(() => {
        count--;
        if (count > 0) {
          updateStats(`Click in your doc — starting in ${count}...`);
        } else {
          clearInterval(ticker);
          updateStats(`0 / ${text.length} characters`);
          set('sai-typing-pause', 'disabled', false);
          set('sai-typing-stop',  'disabled', false);

          sim.start(
            text,
            { durationMinutes, variability, typoRate },
            (fraction, typed, total) => {
              if (fraction === -1) { resetButtons(); return; }
              if (el('sai-typing-progress-fill'))
                el('sai-typing-progress-fill').style.width = (fraction * 100).toFixed(1) + '%';
              updateStats(`${typed} / ${total} characters`);
            },
            (message) => updateStats(message)
          ).then(() => {
            resetButtons();
            updateStats(`Done — ${text.length} / ${text.length} characters`);
          });
        }
      }, 1000);
    });

    // ── Pause / Resume ─────────────────────────────────────────────────────────
    el('sai-typing-pause').addEventListener('click', () => {
      if (sim.isPaused) {
        sim.resume();
        set('sai-typing-pause', 'textContent', 'Pause');
      } else {
        sim.pause();
        set('sai-typing-pause', 'textContent', 'Resume');
      }
    });

    // ── Stop ───────────────────────────────────────────────────────────────────
    el('sai-typing-stop').addEventListener('click', () => {
      sim.stop();
      resetButtons();
    });

    // ── Close ──────────────────────────────────────────────────────────────────
    el('sai-typing-close').addEventListener('click', () => {
      sim.stop();
      panel.remove();
    });

    // ── Minimize ───────────────────────────────────────────────────────────────
    el('sai-typing-minimize').addEventListener('click', () => {
      this._isMinimized = !this._isMinimized;
      const body = el('sai-typing-body');
      const bar  = el('sai-session-bar');
      const btn  = el('sai-typing-minimize');

      if (this._isMinimized) {
        if (body) body.style.display = 'none';
        if (bar)  bar.style.display  = 'none';
        btn.innerHTML = '+';
      } else {
        if (body) body.style.display = '';
        // Restore session bar only for Free users
        if (bar && !this._isPro) bar.style.display = 'flex';
        btn.innerHTML = '&#8722;';
      }
    });

    // ── Paywall: Upgrade button in session bar ─────────────────────────────────
    el('sai-session-upgrade').addEventListener('click', () => {
      this._showPaywall('Upgrade to Pro for unlimited sessions and characters.');
    });

    // ── Paywall: Dismiss ───────────────────────────────────────────────────────
    el('sai-paywall-dismiss').addEventListener('click', () => {
      this._hidePaywall();
    });

    // ── Paywall: "Already have a key?" toggle ──────────────────────────────────
    el('sai-paywall-key-toggle').addEventListener('click', () => {
      const form = el('sai-paywall-key-form');
      if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });

    // ── Paywall: Verify license key ────────────────────────────────────────────
    el('sai-license-verify').addEventListener('click', () => {
      const key    = el('sai-license-input') ? el('sai-license-input').value.trim() : '';
      const status = el('sai-license-status');
      if (!key) return;
      if (status) { status.textContent = 'Verifying…'; status.className = 'sai-license-status'; }
      set('sai-license-verify', 'disabled', true);

      chrome.runtime.sendMessage({ type: 'LICENSE_VERIFY', licenseKey: key }, (res) => {
        set('sai-license-verify', 'disabled', false);
        if (res && res.valid) {
          chrome.storage.local.set({ isPro: true, licenseKey: key }, () => {
            if (status) {
              status.textContent = '✓ License activated! Enjoy Pro.';
              status.className   = 'sai-license-status sai-license-ok';
            }
            setTimeout(() => {
              this._hidePaywall();
              this._loadState(); // Refresh UI to reveal Pro features
            }, 1400);
          });
        } else {
          const msg = (res && res.error) ? res.error : 'Invalid key — please check and try again.';
          if (status) {
            status.textContent = '✗ ' + msg;
            status.className   = 'sai-license-status sai-license-err';
          }
        }
      });
    });

    // ── Pro: Save current text as a named preset ───────────────────────────────
    el('sai-save-preset').addEventListener('click', () => {
      const text = el('sai-typing-text') ? el('sai-typing-text').value : '';
      if (!text.trim()) {
        alert('Paste some text first before saving a preset.');
        return;
      }
      const name = prompt(`Preset name (${PRO_PRESET_LIMIT} max):`);
      if (!name || !name.trim()) return;

      chrome.storage.local.get(['savedPresets'], (data) => {
        const presets = data.savedPresets || [];
        if (presets.length >= PRO_PRESET_LIMIT) {
          alert(`You already have ${PRO_PRESET_LIMIT} presets saved. Delete one to make room.`);
          return;
        }
        presets.push({ name: name.trim(), text });
        chrome.storage.local.set({ savedPresets: presets }, () => this._renderPresets(presets));
      });
    });

    // Drag support
    this._makeDraggable(panel, el('sai-typing-panel-drag'));
  }

  // ─── Drag ───────────────────────────────────────────────────────────────────

  _makeDraggable(panel, handle) {
    let startX, startY, startLeft, startTop;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      startLeft  = rect.left;
      startTop   = rect.top;
      panel.style.right = 'auto';

      const onMove = (e) => {
        panel.style.left = (startLeft + e.clientX - startX) + 'px';
        panel.style.top  = (startTop  + e.clientY - startY) + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }
}

// ─── Bootstrap ──────────────────────────────────────────────────────────────

const uiInjector = new UIInjector();

function initialize() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => uiInjector.injectTypingSimulatorPanel(), 1000);
    });
  } else {
    setTimeout(() => uiInjector.injectTypingSimulatorPanel(), 1000);
  }
}

initialize();
