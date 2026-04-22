/**
 * TypeCloak — UI Injector v1.4.0
 * Injects the floating TypeCloak panel into Google Docs, Canvas, Blackboard, and Moodle.
 * Handles freemium limits, 3-tier paywall, typing profiles, stealth mode,
 * fatigue curve, smart error zones, focus mode, and resume from interruption.
 *
 * Tiers: free → starter ($2.99/mo) → pro ($4.99/mo) → max ($9.99/mo)
 */

// TODO: Replace with your Gumroad membership product URL
// e.g. https://yourname.gumroad.com/l/phantom
// Gumroad will show all 3 tiers on the same page — no need for separate URLs
const GUMROAD_URL         = 'https://20waystomakemoney.gumroad.com/l/ltxii';
const GUMROAD_STARTER_URL = GUMROAD_URL;
const GUMROAD_PRO_URL     = GUMROAD_URL;
const GUMROAD_MAX_URL     = GUMROAD_URL;

const FREE_SESSION_LIMIT = 3;
const FREE_CHAR_LIMIT    = 500;
const PRESET_LIMIT       = 5;
const PROFILE_LIMIT      = 5;

// Tier rank — higher = more access
const TIER_RANK = { free: 0, starter: 1, pro: 2, max: 3 };

class UIInjector {
  constructor() {
    this._tier            = 'free'; // 'free' | 'starter' | 'pro' | 'max'
    this._isMinimized     = false;
    this._isFocusMode     = false;
    this._stealthMode     = false;
    this._fatigueCurve    = false;
    this._smartErrorZones = false;
    this._pendingResume   = null;
  }

  // Returns true if user's tier is at least minTier
  _hasTier(minTier) {
    return (TIER_RANK[this._tier] || 0) >= (TIER_RANK[minTier] || 0);
  }

  // ── Inject ────────────────────────────────────────────────────────────────

  injectTypingSimulatorPanel() {
    if (document.getElementById('sai-typing-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'sai-typing-panel';
    panel.className = 'sai-typing-panel';
    panel.innerHTML = `

      <!-- ── Focus Mode overlay (replaces panel when active) ─────────── -->
      <div class="sai-focus-overlay" id="sai-focus-overlay" style="display:none">
        <div class="sai-focus-ring" id="sai-focus-ring">
          <svg viewBox="0 0 44 44" class="sai-focus-svg">
            <defs>
              <linearGradient id="phantomGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stop-color="#6366f1"/>
                <stop offset="55%"  stop-color="#8b5cf6"/>
                <stop offset="100%" stop-color="#a855f7"/>
              </linearGradient>
            </defs>
            <circle cx="22" cy="22" r="18" class="sai-focus-track"/>
            <circle cx="22" cy="22" r="18" class="sai-focus-fill" id="sai-focus-arc"/>
          </svg>
          <span class="sai-focus-pct" id="sai-focus-pct">0%</span>
        </div>
        <button class="sai-focus-exit" id="sai-focus-exit" title="Exit focus mode">✦</button>
      </div>

      <!-- ── Paywall modal ────────────────────────────────────────────── -->
      <div class="sai-paywall-modal" id="sai-paywall-modal" style="display:none">
        <div class="sai-paywall-content">
          <div class="sai-paywall-glow">✦</div>
          <div class="sai-paywall-title">Upgrade TypeCloak</div>
          <div class="sai-paywall-reason" id="sai-paywall-reason"></div>

          <!-- Tier cards -->
          <div class="sai-tier-grid">
            <div class="sai-tier-card">
              <div class="sai-tier-name">Starter</div>
              <div class="sai-tier-price">$2.99<span class="sai-tier-period">/mo</span></div>
              <div class="sai-tier-desc">Unlimited sessions &amp; characters</div>
              <a class="sai-tier-btn" href="${GUMROAD_STARTER_URL}" target="_blank" rel="noopener">Subscribe</a>
            </div>
            <div class="sai-tier-card sai-tier-card-featured">
              <div class="sai-tier-popular">✦ Popular</div>
              <div class="sai-tier-name">Pro</div>
              <div class="sai-tier-price">$4.99<span class="sai-tier-period">/mo</span></div>
              <div class="sai-tier-desc">+Stealth, Fatigue &amp; Error Zones</div>
              <a class="sai-tier-btn sai-tier-btn-featured" href="${GUMROAD_PRO_URL}" target="_blank" rel="noopener">Subscribe</a>
            </div>
            <div class="sai-tier-card">
              <div class="sai-tier-name">Max</div>
              <div class="sai-tier-price">$9.99<span class="sai-tier-period">/mo</span></div>
              <div class="sai-tier-desc">+Background Mode &amp; AI Profiles</div>
              <a class="sai-tier-btn" href="${GUMROAD_MAX_URL}" target="_blank" rel="noopener">Subscribe</a>
            </div>
          </div>

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

      <!-- ── Resume banner (hidden until a saved session is detected) ── -->
      <div class="sai-resume-banner" id="sai-resume-banner" style="display:none">
        <span class="sai-resume-text" id="sai-resume-text">Resume where you left off?</span>
        <div class="sai-resume-actions">
          <button class="sai-resume-yes" id="sai-resume-yes">↺ Resume</button>
          <button class="sai-resume-no"  id="sai-resume-no">✕</button>
        </div>
      </div>

      <!-- ── Header ───────────────────────────────────────────────────── -->
      <div class="sai-typing-panel-header" id="sai-typing-panel-drag">
        <span class="sai-header-title">
          <span class="sai-header-icon">✦</span>
          TypeCloak
          <span class="sai-pro-badge" id="sai-pro-badge" style="display:none">FREE</span>
        </span>
        <div class="sai-typing-panel-controls">
          <button class="sai-panel-focus"    id="sai-typing-focus"    title="Focus mode">◎</button>
          <button class="sai-panel-minimize" id="sai-typing-minimize" title="Minimize">&#8722;</button>
          <button class="sai-typing-close"   id="sai-typing-close"    title="Close">&#215;</button>
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

        <!-- Speed presets -->
        <div class="sai-typing-field-group">
          <div class="sai-typing-field-inline" style="margin-bottom:6px">
            <label class="sai-typing-label" style="margin:0">Speed</label>
            <span class="sai-wpm-hint" id="sai-wpm-hint">~65 WPM</span>
          </div>
          <div class="sai-speed-pills" id="sai-speed-pills">
            <button class="sai-speed-pill" data-preset="0">Slow</button>
            <button class="sai-speed-pill" data-preset="1">Casual</button>
            <button class="sai-speed-pill active" data-preset="2">Normal</button>
            <button class="sai-speed-pill" data-preset="3">Quick</button>
            <button class="sai-speed-pill" data-preset="4">Fast</button>
          </div>
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

        <!-- Fatigue Curve (Pro) -->
        <div class="sai-stealth-row">
          <div class="sai-stealth-info">
            <span class="sai-stealth-label">Fatigue Curve</span>
            <span class="sai-stealth-desc">Speed naturally decays over session</span>
          </div>
          <div class="sai-stealth-right">
            <span class="sai-stealth-lock-badge" id="sai-fatigue-lock">✦ PRO</span>
            <button class="sai-toggle disabled" id="sai-fatigue-toggle" aria-pressed="false">
              <span class="sai-toggle-thumb"></span>
            </button>
          </div>
        </div>

        <!-- Smart Error Zones (Pro) -->
        <div class="sai-stealth-row">
          <div class="sai-stealth-info">
            <span class="sai-stealth-label">Smart Error Zones</span>
            <span class="sai-stealth-desc">Typos cluster mid-word, like real typing</span>
          </div>
          <div class="sai-stealth-right">
            <span class="sai-stealth-lock-badge" id="sai-smart-errors-lock">✦ PRO</span>
            <button class="sai-toggle disabled" id="sai-smart-errors-toggle" aria-pressed="false">
              <span class="sai-toggle-thumb"></span>
            </button>
          </div>
        </div>

        <!-- Coming Soon (Max) -->
        <div class="sai-stealth-row sai-coming-soon-row">
          <div class="sai-stealth-info">
            <span class="sai-stealth-label">Background Mode</span>
            <span class="sai-stealth-desc">Type while browsing other tabs</span>
          </div>
          <div class="sai-stealth-right">
            <span class="sai-coming-soon-badge">MAX — SOON</span>
          </div>
        </div>
        <div class="sai-stealth-row sai-coming-soon-row">
          <div class="sai-stealth-info">
            <span class="sai-stealth-label">Scheduled Start</span>
            <span class="sai-stealth-desc">Set a timer to begin automatically</span>
          </div>
          <div class="sai-stealth-right">
            <span class="sai-coming-soon-badge">MAX — SOON</span>
          </div>
        </div>
        <div class="sai-stealth-row sai-coming-soon-row">
          <div class="sai-stealth-info">
            <span class="sai-stealth-label">AI Detector Profiles</span>
            <span class="sai-stealth-desc">GPTZero &amp; Turnitin timing patterns</span>
          </div>
          <div class="sai-stealth-right">
            <span class="sai-coming-soon-badge">MAX — SOON</span>
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
      ['sessionsToday', 'lastResetDate', 'tier', 'isPro', 'savedPresets', 'savedProfiles'],
      (data) => {
        // Backward compat: old installs used isPro:true instead of tier
        const tier          = data.tier || (data.isPro ? 'pro' : 'free');
        const today         = new Date().toISOString().slice(0, 10);
        const sessionsToday = (data.lastResetDate === today) ? (data.sessionsToday || 0) : 0;
        const presets       = data.savedPresets  || [];
        const profiles      = data.savedProfiles || [];
        this._applyTierState(tier, sessionsToday, presets, profiles);
      }
    );
  }

  _applyTierState(tier, sessionsToday, presets, profiles) {
    this._tier = tier;
    const el   = (id) => document.getElementById(id);
    const isPaid = this._hasTier('starter');
    const isPro  = this._hasTier('pro');

    // Badge — show tier name for paid users
    if (el('sai-pro-badge')) {
      el('sai-pro-badge').style.display = isPaid ? 'inline-block' : 'none';
      el('sai-pro-badge').textContent   = tier.toUpperCase();
    }

    // Session bar + char counter — free only
    if (el('sai-session-bar'))  el('sai-session-bar').style.display  = isPaid ? 'none' : 'flex';
    if (el('sai-char-counter')) el('sai-char-counter').style.display = isPaid ? 'none' : 'block';

    // Presets + profiles — pro+
    if (el('sai-presets-section'))  el('sai-presets-section').style.display  = isPro ? 'block' : 'none';
    if (el('sai-profiles-section')) el('sai-profiles-section').style.display = isPro ? 'block' : 'none';

    // Pro feature toggles
    const setToggle = (btnId, lockId, unlocked) => {
      if (el(btnId))  el(btnId)[unlocked ? 'classList' : 'classList'][unlocked ? 'remove' : 'add']('disabled');
      if (el(lockId)) el(lockId).style.display = unlocked ? 'none' : '';
    };
    setToggle('sai-stealth-toggle',      'sai-stealth-lock',        isPro);
    setToggle('sai-fatigue-toggle',      'sai-fatigue-lock',        isPro);
    setToggle('sai-smart-errors-toggle', 'sai-smart-errors-lock',   isPro);

    if (isPro) {
      this._renderPresets(presets);
      this._renderProfiles(profiles);
    }
    if (!isPaid) {
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

    const applyToggle = (id, val) => {
      const t = el(id);
      if (t) { t.classList.toggle('active', val); t.setAttribute('aria-pressed', String(val)); }
    };
    this._stealthMode     = !!profile.stealthMode;
    this._fatigueCurve    = !!profile.fatigueCurve;
    this._smartErrorZones = !!profile.smartErrorZones;
    applyToggle('sai-stealth-toggle',      this._stealthMode);
    applyToggle('sai-fatigue-toggle',      this._fatigueCurve);
    applyToggle('sai-smart-errors-toggle', this._smartErrorZones);
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

    // ── Speed presets ──
    // Each preset sets variability + typo rate, and auto-calculates duration from WPM
    // if there's already text loaded in the textarea.
    const SPEED_PRESETS = [
      { label: 'Slow',   wpm: 25,  variability: 20, typoRate: 2  },
      { label: 'Casual', wpm: 45,  variability: 35, typoRate: 3  },
      { label: 'Normal', wpm: 65,  variability: 45, typoRate: 4  },
      { label: 'Quick',  wpm: 90,  variability: 60, typoRate: 6  },
      { label: 'Fast',   wpm: 120, variability: 75, typoRate: 8  },
    ];

    const applyPreset = (idx) => {
      const p = SPEED_PRESETS[idx];
      // Update sliders + labels
      set('sai-typing-variability', 'value', p.variability);
      set('sai-variability-val', 'textContent', p.variability + '%');
      set('sai-typing-typo', 'value', p.typoRate);
      set('sai-typo-val', 'textContent', p.typoRate + '%');
      // Auto-set duration based on text length and target WPM (5 chars ≈ 1 word)
      const text = el('sai-typing-text') ? el('sai-typing-text').value : '';
      if (text.length > 0) {
        const mins = Math.max(0.5, +(text.length / (p.wpm * 5)).toFixed(1));
        set('sai-typing-duration', 'value', mins);
      }
      // WPM hint
      set('sai-wpm-hint', 'textContent', `~${p.wpm} WPM`);
      // Active pill
      document.querySelectorAll('.sai-speed-pill').forEach((btn, i) => {
        btn.classList.toggle('active', i === idx);
      });
    };

    document.querySelectorAll('.sai-speed-pill').forEach((btn) => {
      btn.addEventListener('click', () => applyPreset(parseInt(btn.dataset.preset, 10)));
    });

    // Keep WPM hint live as user edits text
    el('sai-typing-text').addEventListener('input', () => {
      const activeIdx = [...document.querySelectorAll('.sai-speed-pill')]
        .findIndex(b => b.classList.contains('active'));
      if (activeIdx >= 0) applyPreset(activeIdx);
    });

    // ── Slider labels ──
    el('sai-typing-variability').addEventListener('input', (e) => {
      set('sai-variability-val', 'textContent', e.target.value + '%');
      // Deactivate preset pills when user manually adjusts (they no longer match)
      document.querySelectorAll('.sai-speed-pill').forEach(b => b.classList.remove('active'));
      set('sai-wpm-hint', 'textContent', '');
    });
    el('sai-typing-typo').addEventListener('input', (e) => {
      set('sai-typo-val', 'textContent', e.target.value + '%');
    });

    // ── Char counter ──
    el('sai-typing-text').addEventListener('input', (e) => {
      this._updateCharCount(e.target.value.length);
    });

    // ── Pro toggle helper ──
    const makeProToggle = (btnId, paywall, getProp, setProp) => {
      el(btnId).addEventListener('click', () => {
        if (!this._isPro) { this._showPaywall(paywall); return; }
        this[setProp] = !this[getProp]();
        el(btnId).classList.toggle('active', this[setProp]);
        el(btnId).setAttribute('aria-pressed', String(this[setProp]));
      });
    };

    // Stealth Mode
    el('sai-stealth-toggle').addEventListener('click', () => {
      if (!this._hasTier('pro')) {
        this._showPaywall('Stealth Mode requires Pro or Max. Upgrade to unlock anti-detection micro-pauses.');
        return;
      }
      this._stealthMode = !this._stealthMode;
      const t = el('sai-stealth-toggle');
      t.classList.toggle('active', this._stealthMode);
      t.setAttribute('aria-pressed', String(this._stealthMode));
    });

    // Fatigue Curve
    el('sai-fatigue-toggle').addEventListener('click', () => {
      if (!this._hasTier('pro')) {
        this._showPaywall('Fatigue Curve requires Pro or Max. Typing naturally slows over long sessions — much harder to detect.');
        return;
      }
      this._fatigueCurve = !this._fatigueCurve;
      const t = el('sai-fatigue-toggle');
      t.classList.toggle('active', this._fatigueCurve);
      t.setAttribute('aria-pressed', String(this._fatigueCurve));
    });

    // Smart Error Zones
    el('sai-smart-errors-toggle').addEventListener('click', () => {
      if (!this._hasTier('pro')) {
        this._showPaywall('Smart Error Zones requires Pro or Max. Typos cluster in the middle of words, just like real human errors.');
        return;
      }
      this._smartErrorZones = !this._smartErrorZones;
      const t = el('sai-smart-errors-toggle');
      t.classList.toggle('active', this._smartErrorZones);
      t.setAttribute('aria-pressed', String(this._smartErrorZones));
    });

    // ── Focus Mode ──
    el('sai-typing-focus').addEventListener('click', () => this._enterFocusMode());
    el('sai-focus-exit').addEventListener('click',   () => this._exitFocusMode());

    // ── Resume banner ──
    el('sai-resume-yes').addEventListener('click', async () => {
      const saved = await window.loadResumeState();
      if (!saved) return;
      el('sai-resume-banner').style.display = 'none';
      // Pre-fill the text and fire start with resumeFrom
      const ta = el('sai-typing-text');
      if (ta) { ta.value = saved.text; this._updateCharCount(saved.text.length); }
      this._pendingResume = saved;
      // Automatically click Start so the countdown begins
      const startBtn = el('sai-typing-start');
      if (startBtn && !startBtn.disabled) startBtn.click();
    });
    el('sai-resume-no').addEventListener('click', () => {
      el('sai-resume-banner').style.display = 'none';
      window.clearResumeState();
    });

    // ── Check for a saved resume state on load ──
    window.loadResumeState().then(saved => {
      if (!saved) return;
      // Only offer resume if the save is less than 24 hours old
      const ageMs = Date.now() - (saved.timestamp || 0);
      if (ageMs > 86400000) { window.clearResumeState(); return; }
      const remaining = saved.text.length - saved.resumeFrom;
      const el2 = (id) => document.getElementById(id);
      if (el2('sai-resume-text'))
        el2('sai-resume-text').textContent =
          `Resume? ${remaining.toLocaleString()} chars left from last session`;
      if (el2('sai-resume-banner'))
        el2('sai-resume-banner').style.display = 'flex';
    });

    // ── Start ──
    el('sai-typing-start').addEventListener('click', async () => {
      const text = el('sai-typing-text') ? el('sai-typing-text').value : '';
      if (!text.trim()) {
        alert('Please paste some text before starting.');
        return;
      }

      const sessionCheck = await window.checkSessionAllowed();
      if (sessionCheck.tier === 'free') {
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
      const fatigueCurve    = this._fatigueCurve;
      const smartErrorZones = this._smartErrorZones;

      // Check if we're resuming an interrupted session
      const resume    = this._pendingResume || null;
      const resumeFrom = resume ? (resume.resumeFrom || 0) : 0;
      this._pendingResume = null;

      const settings = { durationMinutes, variability, typoRate, stealthMode,
                         fatigueCurve, smartErrorZones, resumeFrom };

      if (el('sai-typing-progress-section')) el('sai-typing-progress-section').style.display = 'block';
      set('sai-typing-start', 'disabled', true);
      set('sai-typing-pause', 'disabled', true);
      set('sai-typing-stop',  'disabled', true);
      if (el('sai-typing-progress-fill')) el('sai-typing-progress-fill').style.width = '0%';

      // Show pre-filled progress when resuming
      if (resumeFrom > 0 && el('sai-typing-progress-fill')) {
        el('sai-typing-progress-fill').style.width = (resumeFrom / text.length * 100).toFixed(1) + '%';
      }

      let count = 3;
      const countMsg = resumeFrom > 0
        ? `Resuming — click in your doc — starting in ${count}…`
        : `Click in your doc — starting in ${count}…`;
      updateStats(countMsg);

      const ticker = setInterval(() => {
        count--;
        if (count > 0) {
          updateStats(resumeFrom > 0
            ? `Resuming — click in your doc — starting in ${count}…`
            : `Click in your doc — starting in ${count}…`);
        } else {
          clearInterval(ticker);
          updateStats(`${resumeFrom.toLocaleString()} / ${text.length.toLocaleString()} characters`);
          set('sai-typing-pause', 'disabled', false);
          set('sai-typing-stop',  'disabled', false);

          sim.start(
            text,
            settings,
            (fraction, typed, total) => {
              if (fraction === -1) { resetButtons(); return; }
              const pct = (fraction * 100).toFixed(1) + '%';
              if (el('sai-typing-progress-fill'))
                el('sai-typing-progress-fill').style.width = pct;
              updateStats(`${typed.toLocaleString()} / ${total.toLocaleString()} characters`);
              // Sync focus mode arc
              this._updateFocusArc(fraction);
            },
            (message) => updateStats(message)
          ).then(() => {
            resetButtons();
            updateStats(`✓ Done — ${text.length.toLocaleString()} characters typed`);
            this._exitFocusMode();
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
      this._showPaywall('Upgrade to Starter or higher for unlimited sessions and characters.');
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
          const tierName = res.tier || 'pro';
          chrome.storage.local.set({ tier: tierName, licenseKey: key }, () => {
            if (status) {
              status.textContent = `✓ ${tierName.charAt(0).toUpperCase() + tierName.slice(1)} activated! Welcome to TypeCloak.`;
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
        fatigueCurve:    this._fatigueCurve,
        smartErrorZones: this._smartErrorZones,
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

  // ── Focus Mode ────────────────────────────────────────────────────────────

  _enterFocusMode() {
    const panel   = document.getElementById('sai-typing-panel');
    const overlay = document.getElementById('sai-focus-overlay');
    const body    = document.getElementById('sai-typing-body');
    const header  = document.getElementById('sai-typing-panel-drag');
    const sesBar  = document.getElementById('sai-session-bar');
    const resume  = document.getElementById('sai-resume-banner');
    if (!overlay) return;
    this._isFocusMode = true;
    if (body)    body.style.display    = 'none';
    if (header)  header.style.display  = 'none';
    if (sesBar)  sesBar.style.display  = 'none';
    if (resume)  resume.style.display  = 'none';
    overlay.style.display = 'flex';
    if (panel)   panel.classList.add('sai-focus-active');
  }

  _exitFocusMode() {
    const panel   = document.getElementById('sai-typing-panel');
    const overlay = document.getElementById('sai-focus-overlay');
    const body    = document.getElementById('sai-typing-body');
    const header  = document.getElementById('sai-typing-panel-drag');
    const sesBar  = document.getElementById('sai-session-bar');
    if (!overlay) return;
    this._isFocusMode = false;
    overlay.style.display = 'none';
    if (body)    body.style.display   = '';
    if (header)  header.style.display = '';
    if (sesBar && !this._isPro) sesBar.style.display = 'flex';
    if (panel)   panel.classList.remove('sai-focus-active');
  }

  /** Update the SVG ring in Focus Mode to match typing progress. */
  _updateFocusArc(fraction) {
    const arc = document.getElementById('sai-focus-arc');
    const pct = document.getElementById('sai-focus-pct');
    if (!arc) return;
    const circumference = 2 * Math.PI * 18; // r=18 from SVG
    const offset = circumference * (1 - Math.min(1, fraction));
    arc.style.strokeDasharray  = circumference;
    arc.style.strokeDashoffset = offset;
    if (pct) pct.textContent = Math.round(fraction * 100) + '%';
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

// Handle keyboard shortcut and context-menu trigger from background script.
// If the panel isn't open yet, inject it first, then fire Start.
chrome.runtime.onMessage.addListener((request) => {
  if (request.type !== 'SHORTCUT_START') return;
  if (!document.getElementById('sai-typing-panel')) {
    uiInjector.injectTypingSimulatorPanel();
    // Panel renders asynchronously; wait one frame before clicking Start
    setTimeout(() => {
      const btn = document.getElementById('sai-typing-start');
      if (btn && !btn.disabled) btn.click();
    }, 150);
  } else {
    const btn = document.getElementById('sai-typing-start');
    if (btn && !btn.disabled) btn.click();
  }
});

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
