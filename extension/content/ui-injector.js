/**
 * Human Typer — UI Injector
 * Injects the floating typing simulator panel into Google Docs pages.
 */

class UIInjector {
  // Inject the typing simulator floating panel
  injectTypingSimulatorPanel() {
    if (document.getElementById('sai-typing-panel')) return;
    if (!window.location.href.includes('docs.google.com')) return;
    if (window.isDocEditable && !window.isDocEditable()) return;

    const panel = document.createElement('div');
    panel.id = 'sai-typing-panel';
    panel.className = 'sai-typing-panel';
    panel.innerHTML = `
      <div class="sai-typing-panel-header" id="sai-typing-panel-drag">
        <span>Human Typer</span>
        <div class="sai-typing-panel-controls">
          <button class="sai-panel-minimize" id="sai-typing-minimize" title="Minimize">&#8722;</button>
          <button class="sai-typing-close" id="sai-typing-close" title="Close">&#215;</button>
        </div>
      </div>
      <div class="sai-typing-panel-body" id="sai-typing-body">
        <div class="sai-typing-field-group">
          <label class="sai-typing-label">Text to type</label>
          <textarea class="sai-typing-textarea" id="sai-typing-text"
                    placeholder="Paste your text here..."></textarea>
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
  }

  _bindTypingPanelEvents(panel) {
    const sim = window.typingSimulator;

    const el = (id) => document.getElementById(id);
    const set = (id, prop, val) => { const e = el(id); if (e) e[prop] = val; };
    const updateStats = (msg) => { if (el('sai-typing-stats')) el('sai-typing-stats').textContent = msg; };

    const resetButtons = () => {
      set('sai-typing-start', 'disabled', false);
      set('sai-typing-pause', 'disabled', true);
      set('sai-typing-stop',  'disabled', true);
      set('sai-typing-pause', 'textContent', 'Pause');
    };

    // Live label updates for sliders
    el('sai-typing-variability').addEventListener('input', (e) => {
      set('sai-variability-val', 'textContent', e.target.value + '%');
    });
    el('sai-typing-typo').addEventListener('input', (e) => {
      set('sai-typo-val', 'textContent', e.target.value + '%');
    });

    // Start button — 3-second countdown, then fires the simulator
    el('sai-typing-start').addEventListener('click', () => {
      const text = el('sai-typing-text') ? el('sai-typing-text').value : '';
      if (!text.trim()) {
        alert('Please paste some text before starting.');
        return;
      }
      const durationMinutes = parseFloat(el('sai-typing-duration').value) || 5;
      const variability = parseInt(el('sai-typing-variability').value) / 100;
      const typoRate = parseInt(el('sai-typing-typo').value) / 100;

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

    // Pause / Resume button
    el('sai-typing-pause').addEventListener('click', () => {
      if (sim.isPaused) {
        sim.resume();
        set('sai-typing-pause', 'textContent', 'Pause');
      } else {
        sim.pause();
        set('sai-typing-pause', 'textContent', 'Resume');
      }
    });

    // Stop button
    el('sai-typing-stop').addEventListener('click', () => {
      sim.stop();
      resetButtons();
    });

    // Close button
    el('sai-typing-close').addEventListener('click', () => {
      sim.stop();
      panel.remove();
    });

    // Minimize button
    el('sai-typing-minimize').addEventListener('click', () => {
      const body = el('sai-typing-body');
      const btn = el('sai-typing-minimize');
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? '' : 'none';
      btn.innerHTML = isHidden ? '&#8722;' : '+';
    });

    // Drag support
    this._makeDraggable(panel, el('sai-typing-panel-drag'));
  }

  _makeDraggable(panel, handle) {
    let startX, startY, startLeft, startTop;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      panel.style.right = 'auto';

      const onMove = (e) => {
        panel.style.left = (startLeft + e.clientX - startX) + 'px';
        panel.style.top  = (startTop  + e.clientY - startY) + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }
}

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
