/**
 * Human Typer — UI Injector v2 (Dark Theme)
 * Injects the floating panel into Google Docs.
 * Handles freemium limits, paywall, Pro presets, typing profiles, and stealth mode.
 */

// TODO: Replace with your Gumroad product URL after creating the product.
// gumroad.com → New Product → $3 → type "License Key" → name "Human Typer Pro"
// Then paste the product page URL here (e.g. https://yourname.gumroad.com/l/human-typer)
const GUMROAD_PRODUCT_URL = 'https://gumroad.com'; // TODO: set your Gumroad product URL

const FREE_SESSION_LIMIT = 3;
const FREE_CHAR_LIMIT    = 500;
const PRO_PRESET_LIMIT   = 5;
const PRO_PROFILE_LIMIT  = 5;

class UIInjector {
  constructor() {
    this._isPro       = false;
    this._isMinimized = false;
    this._stealthMode = false; // live toggle state (not persisted between sessions)
  }

  // ── Inject ────────────────────────────────────────────────────────────────

  injectTypingSimulatorPanel() {
    if (document.getElementById('sai-typing-panel')) return;
    if (!window.location.href.includes('docs.google.com')) return;
    if (window.isDocEditable && !window.isDocEditable()) return;

    const panel = document.createElement('div');
    panel.id = 'sai-typing-panel';
    panel.className = 'sai-typing-panel';
    panel.innerHTML = `

      <!-- ── Paywall modal ────────────────────────────────────────────── -->
      <div class="sai-paywall-modal" id="sai-paywall-modal" style="display:none">
        <div class="sai-paywall-content">
          <div class="sai-paywall-glow">✦</div>
          <div class="sai-paywall-title">Upgrade to Human Typer Pro</div>
          <div class="sai-paywall-reason" id="sai-paywall-reason"></div>
          <ul class="sai-paywall-features">
            <li><span class="sai-paywall-check">✦</span> Unlimited sessions per day</li>
            <li><span class="sai-paywall-check">✦</span> Unlimited characters per session</li>
            <li><span class="sai-paywall-check">✦</span> 5 saved text presets</li>
            <li><span class="sai-paywall-check">✦</span> 5 typing profiles (save settings)</li>
            <li><span class="sai-paywall-check">✦</span> Stealth Mode — anti-detection pauses</li>
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
            <button class="sai-license-verify-btn" id="sai-license-verify">Verify License</button>
            <div class="sai-license-status" id="sai-license-status"></div>
          </div>
          <button class="sai-paywall-dismiss" id="sai-paywall-dismiss">Maybe later</button>
        </div>
      </div>

      <!-- ── Header ───────────────────────────────────────────────────── -->
      <div class="sai-typing-panel-header" id="sai-typing-panel-drag">
        <span class="sai-header-title">
          <span class="sai-header-icon">✦</span>
          Human Typer
          <span class="sai-pro-badge" id="sai-pro-badge" style="display:none">PRO</span>
        </span>
        <div class="sai-typing-panel-controls">
          <button class="sai-panel-minimize" id="sai-typing-minimize" title="Minimize">&#8722;</button>
          <button class="sai-typing-close"   id="sai-typing-close"   title="Close">&#215;</button>
        </div>
      </div>

      <!-- ── Session bar (Free) ────────────────────────────────────────── -->
      <div class="sai-session-bar" id="sai-session-bar" style="display:none">
        <span style="white-space:nowrap">Sessions</span>
        <div class="sai-session-pips" id="sai-session-pips">
          <div class="sai-session-pip"></div>
          <div class="sai-session-pip"></div>
          <div class="sai-session-pip"></div>
        </div>
        <span id="sai-session-count-text" style="white-space:nowrap">0 / 3 today</span>
        <button class="sai-upgrade-link" id="sai-session-upgrade">Upgrade ↑</button>
      </div>

      <!-- ── Panel body ────────────────────────────────────────────────── -->
      <div class="sai-typing-panel-body" id="sai-typing-body">

        <!-- Text input -->
        <div class="sai-typing-field-group">
          <label class="sai-typing-label">Text to type</label>
          <textarea class="sai-typing-textarea" id="sai-typing-text"
                    placeholder="Paste your text here…"></textarea>
          <div class="sai-char-counter" id="sai-char-counter" style="display:none">
            <span id="sai-char-count">0</span> / ${FREE_CHAR_LIMIT} chars (free limit)
          </div>
        </div>

        <!-- Text Presets (Pro) -->
        <div class="sai-section-card" id="sai-presets-section" style="display:none">
          <div class="sai-section-card-header">
            <span class="sai-section-card-title">Text Presets</span>
            <button class="sai-section-save-btn" id="sai-save-preset">+ Save Text</button>
          </div>
          <div class="sai-section-list" id="sai-presets-list"></div>
        </div>

        <!-- Duration -->
        <div class="sai-typing-field-inline">
          <label class="sai-typing-label" style="margin:0">Duration (min)</label>
          <input type="number" class="sai-typing-number-input" id="sai-typing-duration"
                 value="5" min="0.5" max="120" step="0.5">
        </div>

        <!-- Speed variability -->
        <div class="sai-typing-field-group">
          <div class="sai-typing-field-inline" style="margin-bottom:6px">
            <label class="sai-typing-label" style="margin:0">Speed variability</label>
            <span class="sai-slider-val" id="sai-variability-val">40%</span>
          </div>
          <div class="sai-slider-row">
            <input type="range" class="sai-typing-slider" id="sai-typing-variability"
                   min="0" max="100" value="40">
          </div>
        </div>

        <!-- Typo rate -->
        <div class="sai-typing-field-group">
          <div class="sai-typing-field-inline" style="margin-bottom:6px">
            <label class="sai-typing-label" style="margin:0">Typo rate</label>
            <span class="sai-slider-val" id="sai-typo-val">3%</span>
          </div>
          <div class="sai-slider-row">
            <input type="range" class="sai-typing-slider" id="sai-typing-typo"
                   min="0" max="15" value="3">
          </div>
        </div>

        <!-- Stealth Mode (visible to all; locked for Free) -->
        <div class="sai-stealth-row">
          <div class="sai-stealth-info">
            <span class="sai-stealth-label">Stealth Mode</span>
            <span class="sai-stealth-desc">Micro-pauses &amp; anti-detection</span>
          </div>
          <div class="sai-stealth-right">
            <span class="sai-stealth-lock-badge" id="sai-stealth-lock">✦ PRO</span>
            <button class="sai-toggle disabled" id="sai-stealth-toggle" aria-pressed="false">
              <span class="sai-toggle-thumb"></span>
            </button>
          </div>
        </div>

        <!-- Typing Profiles (Pro) -->
        <div class="sai-section-card" id="sai-profiles-section" style="display:none">
          <div class="sai-section-card-header">
            <span class="sai-section-card-title">Typing Profiles</span>
            <button class="sai-section-save-btn" id="sai-save-profile">+ Save Settings</button>
          </div>
          <div class="sai-section-list" id="sai-profiles-list"></div>
        </div>

        <div class="sai-divider"></div>

        <!-- Progress -->
        <div class="sai-typing-progress-section" id="sai-typing-progress-section" style="display:none">
          <div class="sai-typing-progress-bar">
            <div class="sai-typing-progress-fill" id="sai-typing-progress-fill"></div>
          </div>
          <div class="sai-typing-stats" id="sai-typing-stats">0 / 0 characters</div>
        </div>

        <!-- Buttons -->
        <div class="sai-typing-buttons">
          <button class="sai-btn-start" id="sai-typing-start">▶&nbsp;Start</button>
          <button class="sai-btn-pause" id="sai-typing-pause" disabled>⏸&nbsp;Pause</button>
          <button class="sai-btn-stop"  id="sai-typing-stop"  disabled>⏹&nbsp;Stop</button>
        </div>

      </div><!-- end body -->
    `;

    document.body.appendChild(panel);
    this._bindTypingPanelEvents(panel);
    this._loadState();
  }

  // ── State ─────────────────────────────────────────────────────────────────

  _loadState() {
    chrome.storage.local.get(
      ['sessionsToday', 'lastResetDate', 'isPro', 'savedPresets', 'savedProfiles'],
      (data) => {
        const today        = new Date().toISOString().slice(0, 10);
        const isPro        = !!data.isPro;
        const sessionsToday = (data.lastResetDate === today) ? (data.sessionsToday || 0) : 0;
        const presets      = data.savedPresets  || [];
        const profiles     = data.savedProfiles || [];
        this._applyProState(isPro, sessionsToday, presets, profiles);
      }
    );
  }

  _applyProState(isPro, sessionsToday, presets, profiles) {
    this._isPro = isPro;
    const el = (id) => document.getElementById(id);

    if (isPro) {
      if (el('sai-pro-badge'))        el('sai-pro-badge').style.display        = 'inline-block';
      if (el('sai-session-bar'))      el('sai-session-bar').style.display      = 'none';
      if (el('sai-char-counter'))     el('sai-char-counter').style.display     = 'none';
      if (el('sai-presets-section'))  el('sai-presets-section').style.display  = 'block';
      if (el('sai-profiles-section')) el('sai-profiles-section').style.display = 'block';
      // Unlock stealth mode toggle
      if (el('sai-stealth-toggle'))   el('sai-stealth-toggle').classList.remove('disabled');
      if (el('sai-stealth-lock'))     el('sai-stealth-lock').style.display     = 'none';
      this._renderPresets(presets);
      this._renderProfiles(profiles);
    } else {
      if (el('sai-pro-badge'))        el('sai-pro-badge').style.display        = 'none';
      if (el('sai-session-bar'))      el('sai-session-bar').style.display      = 'flex';
      if (el('sai-char-counter'))     el('sai-char-counter').style.display     = 'block';
      if (el('sai-presets-section'))  el('sai-presets-section').style.display  = 'none';
      if (el('sai-profiles-section')) el('sai-profiles-section').style.display = 'none';
      // Keep stealth toggle locked
      if (el('sai-stealth-toggle'))   el('sai-stealth-toggle').classList.add('disabled');
      if (el('sai-stealth-lock'))     el('sai-stealth-lock').style.display     = '';
      this._updateSessionPips(sessionsToday);
      const ta = el('sai-typing-text');
      this._updateCharCount(ta ? ta.value.length : 0);
    }
  }

  _updateSessionPips(sessionsToday) {
    const el = (id) => document.getElementById(id);
    const pips = document.querySelectorAll('.sai-session-pip');
    pips.forEach((pip, i) => {
      pip.classList.toggle('used', i < sessionsToday);
      pip.classList.toggle('last', i === FREE_SESSION_LIMIT - 1 && sessionsToday >= FREE_SESSION_LIMIT);
    });
    if (el('sai-session-count-text'))
      el('sai-session-count-text').textContent = `${sessionsToday} / ${FREE_SESSION_LIMIT} today`;
  }

  // ── List renderers ────────────────────────────────────────────────────────

  _renderPresets(presets) {
    this._renderItemList(
      'sai-presets-list',
      presets,
      (idx) => {
        chrome.storage.local.get(['savedPresets'], (data) => {
          const ps = data.savedPresets || [];
          const ta = document.getElementById('sai-typing-text');
          if (ta && ps[idx]) {
            ta.value = ps[idx].text;
            this._updateCharCount(ta.value.length);
          }
        });
      },
      (idx) => {
        chrome.storage.local.get(['savedPresets'], (data) => {
          const ps = (data.savedPresets || []).filter((_, i) => i !== idx);
          chrome.storage.local.set({ savedPresets: ps }, () => this._renderPresets(ps));
        });
      }
    );
  }

  _renderProfiles(profiles) {
    this._renderItemList(
      'sai-profiles-list',
      profiles,
      (idx) => {
        chrome.storage.local.get(['savedProfiles'], (data) => {
          const ps = data.savedProfiles || [];
          if (ps[idx]) this._loadProfile(ps[idx]);
        });
      },
      (idx) => {
        chrome.storage.local.get(['savedProfiles'], (data) => {
          const ps = (data.savedProfiles || []).filter((_, i) => i !== idx);
          chrome.storage.local.set({ savedProfiles: ps }, () => this._renderProfiles(ps));
        });
      }
    );
  }

  /** Generic list renderer shared by presets and profiles. */
  _renderItemList(containerId, items, onLoad, onDelete) {
    const list = document.getElementById(containerId);
    if (!list) return;

    if (!items || items.length === 0) {
      list.innerHTML = '<div class="sai-section-empty">Nothing saved yet.</div>';
      return;
    }

    list.innerHTML = items.map((item, i) => `
      <div class="sai-item-row">
        <button class="sai-item-load-btn" data-index="${i}">${this._esc(item.name)}</button>
        <button class="sai-item-delete-btn" data-index="${i}" title="Delete">&#215;</button>
      </div>
    `).join('');

    list.querySelectorAll('.sai-item-load-btn').forEach(btn => {
      btn.addEventListener('click', () => onLoad(parseInt(btn.dataset.index, 10)));
    });
    list.querySelectorAll('.sai-item-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => onDelete(parseInt(btn.dataset.index, 10)));
    });
  }

  /** Fill all controls from a saved profile object. */
  _loadProfile(profile) {
    const el  = (id) => document.getElementById(id);
    const set = (id, prop, val) => { const e = el(id); if (e) e[prop] = val; };

    set('sai-typing-duration',    'value',       profile.durationMinutes ?? 5);
    set('sai-typing-variability', 'value',       profile.variability     ?? 40);
    set('sai-typing-typo',        'value',       profile.typoRate        ?? 3);
    set('sai-variability-val',    'textContent', (profile.variability ?? 40) + '%');
    set('sai-typo-val',           'textContent', (profile.typoRate    ?? 3)  + '%');

    const stealth = !!profile.stealthMode;
    this._stealthMode = stealth;
    const toggle = el('sai-stealth-toggle');
    if (toggle) {
      toggle.classList.toggle('active', stealth);
      toggle.setAttribute('aria-pressed', String(stealth));
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  _updateCharCount(len) {
    const span    = document.getElementById('sai-char-count');
    const counter = document.getElementById('sai-char-counter');
    if (span)    span.textContent = len;
    if (counter) counter.classList.toggle('over-limit', len > FREE_CHAR_LIMIT);
  }

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Paywall ───────────────────────────────────────────────────────────────

  _showPaywall(reason) {
    const el = (id) => document.getElementById(id);
    if (el('sai-paywall-reason'))    el('sai-paywall-reason').textContent    = reason;
    if (el('sai-paywall-key-form'))  el('sai-paywall-key-form').style.display = 'none';
    if (el('sai-license-input'))     el('sai-license-input').value            = '';
    if (el('sai-license-status')) {
      el('sai-license-status').textContent = '';
      el('sai-license-status').className   = 'sai-license-status';
    }
    if (el('sai-paywall-modal'))     el('sai-paywall-modal').style.display    = 'flex';
  }

  _hidePaywall() {
    const modal = document.getElementById('sai-paywall-modal');
    if (modal) modal.style.display = 'none';
  }

  // ── Events ────────────────────────────────────────────────────────────────

  _bindTypingPanelEvents(panel) {
    const sim = window.typingSimulator;
    const el  = (id) => document.getElementById(id);
    const set = (id, prop, val) => { const e = el(id); if (e) e[prop] = val; };
    const updateStats = (msg) => { if (el('sai-typing-stats')) el('sai-typing-stats').textContent = msg; };

    const resetButtons = () => {
      set('sai-typing-start', 'disabled', false);
      set('sai-typing-pause', 'disabled', true);
      set('sai-typing-stop',  'disabled', true);
      set('sai-typing-pause', 'textContent', '⏸\u00a0Pause');
    };

    // ── Slider labels ──
    el('sai-typing-variability').addEventListener('input', (e) => {
      set('sai-variability-val', 'textContent', e.target.value + '%');
    });
    el('sai-typing-typo').addEventListener('input', (e) => {
      set('sai-typo-val', 'textContent', e.target.value + '%');
    });

    // ── Char counter ──
    el('sai-typing-text').addEventListener('input', (e) => {
      this._updateCharCount(e.target.value.length);
    });

    // ── Stealth mode toggle ──
    el('sai-stealth-toggle').addEventListener('click', () => {
      if (!this._isPro) {
        this._showPaywall('Stealth Mode is a Pro feature. Upgrade to unlock anti-detection micro-pauses.');
        return;
      }
      this._stealthMode = !this._stealthMode;
      const toggle = el('sai-stealth-toggle');
      toggle.classList.toggle('active', this._stealthMode);
      toggle.setAttribute('aria-pressed', String(this._stealthMode));
    });

    // ── Start ──
    el('sai-typing-start').addEventListener('click', async () => {
      const text = el('sai-typing-text') ? el('sai-typing-text').value : '';
      if (!text.trim()) {
        alert('Please paste some text before starting.');
        return;
      }

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

      await window.incrementSession();

      // Refresh pip counter
      chrome.storage.local.get(['sessionsToday', 'lastResetDate'], (data) => {
        const today = new Date().toISOString().slice(0, 10);
        const count = (data.lastResetDate === today) ? (data.sessionsToday || 0) : 0;
        this._updateSessionPips(count);
      });

      const durationMinutes = parseFloat(el('sai-typing-duration').value) || 5;
      const variability     = parseInt(el('sai-typing-variability').value, 10) / 100;
      const typoRate        = parseInt(el('sai-typing-typo').value, 10) / 100;
      const stealthMode     = this._stealthMode;

      if (el('sai-typing-progress-section')) el('sai-typing-progress-section').style.display = 'block';
      set('sai-typing-start', 'disabled', true);
      set('sai-typing-pause', 'disabled', true);
      set('sai-typing-stop',  'disabled', true);
      if (el('sai-typing-progress-fill')) el('sai-typing-progress-fill').style.width = '0%';

      let count = 3;
      updateStats(`Click in your doc — starting in ${count}…`);

      const ticker = setInterval(() => {
        count--;
        if (count > 0) {
          updateStats(`Click in your doc — starting in ${count}…`);
        } else {
          clearInterval(ticker);
          updateStats(`0 / ${text.length} characters`);
          set('sai-typing-pause', 'disabled', false);
          set('sai-typing-stop',  'disabled', false);

          sim.start(
            text,
            { durationMinutes, variability, typoRate, stealthMode },
            (fraction, typed, total) => {
              if (fraction === -1) { resetButtons(); return; }
              if (el('sai-typing-progress-fill'))
                el('sai-typing-progress-fill').style.width = (fraction * 100).toFixed(1) + '%';
              updateStats(`${typed.toLocaleString()} / ${total.toLocaleString()} characters`);
            },
            (message) => updateStats(message)
          ).then(() => {
            resetButtons();
            updateStats(`✓ Done — ${text.length.toLocaleString()} characters typed`);
          });
        }
      }, 1000);
    });

    // ── Pause / Resume ──
    el('sai-typing-pause').addEventListener('click', () => {
      if (sim.isPaused) {
        sim.resume();
        set('sai-typing-pause', 'textContent', '⏸\u00a0Pause');
      } else {
        sim.pause();
        set('sai-typing-pause', 'textContent', '▶\u00a0Resume');
      }
    });

    // ── Stop ──
    el('sai-typing-stop').addEventListener('click', () => {
      sim.stop();
      resetButtons();
    });

    // ── Close ──
    el('sai-typing-close').addEventListener('click', () => {
      sim.stop();
      panel.remove();
    });

    // ── Minimize ──
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
        if (bar && !this._isPro) bar.style.display = 'flex';
        btn.innerHTML = '&#8722;';
      }
    });

    // ── Session bar: Upgrade button ──
    el('sai-session-upgrade').addEventListener('click', () => {
      this._showPaywall('Upgrade to Pro for unlimited sessions and characters.');
    });

    // ── Paywall: dismiss ──
    el('sai-paywall-dismiss').addEventListener('click', () => this._hidePaywall());

    // ── Paywall: "Already have a key?" toggle ──
    el('sai-paywall-key-toggle').addEventListener('click', () => {
      const form = el('sai-paywall-key-form');
      if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });

    // ── Paywall: verify license ──
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
              status.textContent = '✓ License activated! Welcome to Pro.';
              status.className   = 'sai-license-status sai-license-ok';
            }
            setTimeout(() => {
              this._hidePaywall();
              this._loadState();
            }, 1400);
          });
        } else {
          const msg = (res && res.error) ? res.error : 'Invalid key — check and try again.';
          if (status) {
            status.textContent = '✗ ' + msg;
            status.className   = 'sai-license-status sai-license-err';
          }
        }
      });
    });

    // ── Pro: Save text preset ──
    el('sai-save-preset').addEventListener('click', () => {
      const text = el('sai-typing-text') ? el('sai-typing-text').value : '';
      if (!text.trim()) { alert('Paste some text first.'); return; }
      const name = prompt(`Preset name (${PRO_PRESET_LIMIT} max):`);
      if (!name || !name.trim()) return;
      chrome.storage.local.get(['savedPresets'], (data) => {
        const ps = data.savedPresets || [];
        if (ps.length >= PRO_PRESET_LIMIT) {
          alert(`You have ${PRO_PRESET_LIMIT} presets already. Delete one to make room.`);
          return;
        }
        ps.push({ name: name.trim(), text });
        chrome.storage.local.set({ savedPresets: ps }, () => this._renderPresets(ps));
      });
    });

    // ── Pro: Save typing profile ──
    el('sai-save-profile').addEventListener('click', () => {
      const name = prompt(`Profile name (${PRO_PROFILE_LIMIT} max):`);
      if (!name || !name.trim()) return;
      const profile = {
        name:            name.trim(),
        durationMinutes: parseFloat(el('sai-typing-duration').value) || 5,
        variability:     parseInt(el('sai-typing-variability').value, 10),
        typoRate:        parseInt(el('sai-typing-typo').value, 10),
        stealthMode:     this._stealthMode,
      };
      chrome.storage.local.get(['savedProfiles'], (data) => {
        const ps = data.savedProfiles || [];
        if (ps.length >= PRO_PROFILE_LIMIT) {
          alert(`You have ${PRO_PROFILE_LIMIT} profiles already. Delete one to make room.`);
          return;
        }
        ps.push(profile);
        chrome.storage.local.set({ savedProfiles: ps }, () => this._renderProfiles(ps));
      });
    });

    // ── Drag ──
    this._makeDraggable(panel, el('sai-typing-panel-drag'));
  }

  // ── Drag ──────────────────────────────────────────────────────────────────

  _makeDraggable(panel, handle) {
    let startX, startY, startLeft, startTop;
    handle.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      startX = e.clientX; startY = e.clientY;
      const r = panel.getBoundingClientRect();
      startLeft = r.left; startTop = r.top;
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

// ── Bootstrap ────────────────────────────────────────────────────────────────

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
