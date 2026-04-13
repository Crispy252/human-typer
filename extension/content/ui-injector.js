// UI Injector for Schoology AI Assistant
// Injects control buttons and overlays into Schoology pages

class UIInjector {
  constructor() {
    this.overlay = null;
    this.backdrop = null;
    this.isProcessing = false;
  }

  // Inject "Auto-Complete" button into assignment pages
  injectAutoCompleteButton() {
    // Check if button already exists
    if (document.querySelector('.sai-button')) {
      return;
    }

    // Try Schoology detector first
    let assignment = window.schoologyDetector ? window.schoologyDetector.getCurrentAssignment() : null;

    // Try Google Docs detector if no Schoology assignment found
    if (!assignment && window.googleDocsDetector) {
      assignment = window.googleDocsDetector.getCurrentAssignment();
    }

    if (!assignment) {
      return;
    }

    // Find appropriate location to inject button
    const buttonContainer = this.findButtonContainer(assignment.type);

    if (!buttonContainer) {
      return;
    }

    // Create button
    const button = document.createElement('button');
    button.className = 'sai-button';
    button.innerHTML = `
      <svg class="sai-button-icon" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm3.707 6.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
      </svg>
      <span>AI Auto-Complete</span>
    `;

    button.addEventListener('click', () => this.handleAutoCompleteClick(assignment));

    buttonContainer.insertBefore(button, buttonContainer.firstChild);

    // Add warning message
    const warning = document.createElement('div');
    warning.className = 'sai-warning';
    warning.innerHTML = `
      ⚠️ <strong>Use Responsibly:</strong> This AI assistant is for educational purposes.
      Verify all answers and ensure compliance with your institution's academic integrity policies.
    `;
    buttonContainer.insertBefore(warning, button.nextSibling);
  }

  // Find appropriate container for button injection
  findButtonContainer(assignmentType) {
    const selectors = {
      quiz: [
        '.quiz-header',
        '.quiz-controls',
        '.quiz-container',
        'form'
      ],
      essay: [
        '.submission-container',
        '.assignment-submission',
        'form'
      ],
      discussion: [
        '.discussion-reply-container',
        '.comment-form',
        'form'
      ],
      google_doc: [
        '#docs-toolbar',
        '.docs-titlebar',
        'body'
      ],
      google_slides: [
        '#docs-toolbar',
        '.docs-titlebar',
        'body'
      ]
    };

    const typeSelectors = selectors[assignmentType] || [];

    for (const selector of typeSelectors) {
      const container = document.querySelector(selector);
      if (container) {
        return container;
      }
    }

    // Fallback to body
    return document.body;
  }

  // Handle auto-complete button click
  async handleAutoCompleteClick(assignment) {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.showProcessingOverlay(assignment);

    try {
      // Send assignment to background script for processing
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'PROCESS_ASSIGNMENT',
          assignment: {
            type: assignment.type,
            title: assignment.title,
            data: this.serializeAssignment(assignment)
          }
        }, resolve);
      });

      if (response.error) {
        this.showError(response.error);
        return;
      }

      // Fill in the answers
      await this.fillAnswers(assignment, response.result);

      this.showSuccess(`Assignment completed! ${assignment.type === 'quiz' ? response.result.answers.length + ' questions answered' : 'Response generated'}`);

    } catch (error) {
      this.showError(`Error: ${error.message}`);
    } finally {
      this.isProcessing = false;
      setTimeout(() => this.hideOverlay(), 2000);
    }
  }

  // Serialize assignment data for transmission
  serializeAssignment(assignment) {
    switch (assignment.type) {
      case 'quiz':
        return {
          questions: assignment.questions.map(q => ({
            index: q.index,
            text: q.text,
            type: q.type,
            options: q.options.map(o => ({ text: o.text, value: o.value }))
          }))
        };

      case 'essay':
        return {
          instructions: assignment.instructions,
          requirements: assignment.requirements
        };

      case 'discussion':
        return {
          prompt: assignment.prompt,
          existingPosts: assignment.existingPosts
        };

      case 'google_doc':
        return {
          title: assignment.title,
          instructions: assignment.instructions,
          existingContent: assignment.existingContent,
          requirements: assignment.requirements,
          isEmpty: assignment.isEmpty
        };

      case 'google_slides':
        return {
          title: assignment.title,
          instructions: assignment.instructions,
          requirements: assignment.requirements,
          slideCount: assignment.slideCount
        };

      default:
        return {};
    }
  }

  // Fill in answers from AI response
  async fillAnswers(assignment, result) {
    switch (assignment.type) {
      case 'quiz':
        return this.fillQuizAnswers(assignment, result.answers);

      case 'essay':
        return this.fillEssayAnswer(assignment, result.text);

      case 'discussion':
        return this.fillDiscussionAnswer(assignment, result.text);

      case 'google_doc':
        return this.fillGoogleDoc(assignment, result.text);

      case 'google_slides':
        return this.fillGoogleSlides(assignment, result.slides);
    }
  }

  // Fill quiz answers
  fillQuizAnswers(assignment, answers) {
    answers.forEach((answer, index) => {
      const question = assignment.questions[index];
      if (!question) return;

      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        // Select the chosen option
        const option = question.options[answer.selectedIndex];
        if (option && option.element) {
          option.element.click();
          option.element.checked = true;
        }
      } else if (question.type === 'short_answer' || question.type === 'long_answer') {
        // Fill in text answer
        const input = question.element.querySelector('input[type="text"], textarea');
        if (input) {
          input.value = answer.text;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    });
  }

  // Fill essay answer
  fillEssayAnswer(assignment, text) {
    const element = assignment.element;

    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element.contentEditable === 'true') {
      element.textContent = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Fill discussion answer
  fillDiscussionAnswer(assignment, text) {
    this.fillEssayAnswer(assignment, text);
  }

  // Show processing overlay
  showProcessingOverlay(assignment) {
    this.hideOverlay(); // Remove any existing overlay

    // Create backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'sai-overlay-backdrop';
    document.body.appendChild(this.backdrop);

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'sai-overlay';
    this.overlay.innerHTML = `
      <div class="sai-overlay-header">
        <h2 class="sai-overlay-title">AI Auto-Complete</h2>
        <button class="sai-close-button" id="sai-close">&times;</button>
      </div>
      <div class="sai-progress">
        <div class="sai-progress-bar">
          <div class="sai-progress-fill" style="width: 0%" id="sai-progress"></div>
        </div>
        <div class="sai-status-text">
          <span class="sai-spinner"></span>
          <span id="sai-status">Processing assignment...</span>
        </div>
      </div>
      <div id="sai-message"></div>
    `;

    document.body.appendChild(this.overlay);

    // Close button handler
    document.getElementById('sai-close').addEventListener('click', () => {
      if (!this.isProcessing) {
        this.hideOverlay();
      }
    });

    // Simulate progress
    this.simulateProgress();
  }

  // Simulate progress bar animation
  simulateProgress() {
    const progressBar = document.getElementById('sai-progress');
    let width = 0;

    const interval = setInterval(() => {
      if (width >= 90 || !this.isProcessing) {
        clearInterval(interval);
        return;
      }

      width += Math.random() * 15;
      width = Math.min(width, 90);
      if (progressBar) {
        progressBar.style.width = width + '%';
      }
    }, 500);
  }

  // Show error message
  showError(message) {
    const messageDiv = document.getElementById('sai-message');
    const statusText = document.getElementById('sai-status');
    const progressBar = document.getElementById('sai-progress');

    if (progressBar) {
      progressBar.style.width = '100%';
      progressBar.style.background = '#dc3545';
    }

    if (statusText) {
      statusText.innerHTML = '✗ Error occurred';
    }

    if (messageDiv) {
      messageDiv.innerHTML = `<div class="sai-error">${message}</div>`;
    }
  }

  // Show success message
  showSuccess(message) {
    const messageDiv = document.getElementById('sai-message');
    const statusText = document.getElementById('sai-status');
    const progressBar = document.getElementById('sai-progress');

    if (progressBar) {
      progressBar.style.width = '100%';
    }

    if (statusText) {
      statusText.innerHTML = '✓ Completed successfully';
    }

    if (messageDiv) {
      messageDiv.innerHTML = `<div class="sai-success">${message}</div>`;
    }
  }

  // Fill Google Doc with generated content
  fillGoogleDoc(assignment, text) {
    if (window.googleDocsDetector) {
      window.googleDocsDetector.insertTextIntoDoc(text);
      return true;
    }
    return false;
  }

  // Fill Google Slides with generated content
  fillGoogleSlides(assignment, slides) {
    // For now, just show the generated content in the overlay
    // Actual slide manipulation is complex and may require different approach
    const messageDiv = document.getElementById('sai-message');
    if (messageDiv && slides) {
      messageDiv.innerHTML = `
        <div class="sai-success">
          Generated ${slides.length} slides! Copy the content below and paste into your presentation:
          <pre style="white-space: pre-wrap; margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
${slides.map((slide, i) => `Slide ${i + 1}: ${slide.title}\n${slide.content}`).join('\n\n')}
          </pre>
        </div>
      `;
    }
    return true;
  }

  // Hide overlay
  hideOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    if (this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
    }
  }

  // Inject the Typing Simulator floating panel (Google Docs only)
  injectTypingSimulatorPanel() {
    if (document.getElementById('sai-typing-panel')) return;
    if (!window.location.href.includes('docs.google.com')) return;
    if (window.isDocEditable && !window.isDocEditable()) return;

    const panel = document.createElement('div');
    panel.id = 'sai-typing-panel';
    panel.className = 'sai-typing-panel';
    panel.innerHTML = `
      <div class="sai-typing-panel-header" id="sai-typing-panel-drag">
        <span>Typing Simulator</span>
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

    // Live label updates for sliders
    document.getElementById('sai-typing-variability').addEventListener('input', (e) => {
      document.getElementById('sai-variability-val').textContent = e.target.value + '%';
    });
    document.getElementById('sai-typing-typo').addEventListener('input', (e) => {
      document.getElementById('sai-typo-val').textContent = e.target.value + '%';
    });

    // Start button — runs a 3-second countdown so the user can click into the doc
    document.getElementById('sai-typing-start').addEventListener('click', () => {
      const text = document.getElementById('sai-typing-text').value;
      if (!text.trim()) {
        alert('Please paste some text before starting.');
        return;
      }
      const durationMinutes = parseFloat(document.getElementById('sai-typing-duration').value) || 5;
      const variability = parseInt(document.getElementById('sai-typing-variability').value) / 100;
      const typoRate = parseInt(document.getElementById('sai-typing-typo').value) / 100;

      document.getElementById('sai-typing-progress-section').style.display = 'block';
      document.getElementById('sai-typing-start').disabled = true;
      document.getElementById('sai-typing-pause').disabled = true;
      document.getElementById('sai-typing-stop').disabled = true;
      document.getElementById('sai-typing-progress-fill').style.width = '0%';

      // Countdown: give the user time to click into the Google Doc
      let count = 3;
      const statsEl = document.getElementById('sai-typing-stats');
      statsEl.textContent = `Click in your doc — starting in ${count}...`;
      const ticker = setInterval(() => {
        count--;
        if (count > 0) {
          statsEl.textContent = `Click in your doc — starting in ${count}...`;
        } else {
          clearInterval(ticker);
          statsEl.textContent = `0 / ${text.length} characters`;
          document.getElementById('sai-typing-pause').disabled = false;
          document.getElementById('sai-typing-stop').disabled = false;

          sim.start(
            text,
            { durationMinutes, variability, typoRate },
            (fraction, typed, total) => {
              if (fraction === -1) {
                document.getElementById('sai-typing-start').disabled = false;
                document.getElementById('sai-typing-pause').disabled = true;
                document.getElementById('sai-typing-stop').disabled = true;
                return;
              }
              document.getElementById('sai-typing-progress-fill').style.width = (fraction * 100).toFixed(1) + '%';
              statsEl.textContent = `${typed} / ${total} characters`;
            },
            (message) => {
              // Step-by-step status — shown directly in the panel
              statsEl.textContent = message;
            }
          ).then(() => {
            document.getElementById('sai-typing-start').disabled = false;
            document.getElementById('sai-typing-pause').disabled = true;
            document.getElementById('sai-typing-stop').disabled = true;
            document.getElementById('sai-typing-pause').textContent = 'Pause';
            document.getElementById('sai-typing-stats').textContent = `Done — ${text.length} / ${text.length} characters`;
          });
        }
      }, 1000);
    });

    // Pause / Resume button
    document.getElementById('sai-typing-pause').addEventListener('click', () => {
      if (sim.isPaused) {
        sim.resume();
        document.getElementById('sai-typing-pause').textContent = 'Pause';
      } else {
        sim.pause();
        document.getElementById('sai-typing-pause').textContent = 'Resume';
      }
    });

    // Stop button
    document.getElementById('sai-typing-stop').addEventListener('click', () => {
      sim.stop();
      document.getElementById('sai-typing-start').disabled = false;
      document.getElementById('sai-typing-pause').disabled = true;
      document.getElementById('sai-typing-stop').disabled = true;
      document.getElementById('sai-typing-pause').textContent = 'Pause';
    });

    // Close button
    document.getElementById('sai-typing-close').addEventListener('click', () => {
      sim.stop();
      panel.remove();
    });

    // Minimize button
    document.getElementById('sai-typing-minimize').addEventListener('click', () => {
      const body = document.getElementById('sai-typing-body');
      const btn = document.getElementById('sai-typing-minimize');
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? '' : 'none';
      btn.innerHTML = isHidden ? '&#8722;' : '+';
    });

    // Drag support
    this._makeDraggable(panel, document.getElementById('sai-typing-panel-drag'));
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

// Initialize UI injector
const uiInjector = new UIInjector();

// Inject button when page loads
function initialize() {
  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => uiInjector.injectAutoCompleteButton(), 1000);
      if (window.location.href.includes('docs.google.com')) {
        setTimeout(() => uiInjector.injectTypingSimulatorPanel(), 1500);
      }
    });
  } else {
    setTimeout(() => uiInjector.injectAutoCompleteButton(), 1000);
    if (window.location.href.includes('docs.google.com')) {
      setTimeout(() => uiInjector.injectTypingSimulatorPanel(), 1500);
    }
  }

  // Re-inject on URL changes (for single-page app navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      setTimeout(() => uiInjector.injectAutoCompleteButton(), 1000);
    }
  }).observe(document, { subtree: true, childList: true });
}

initialize();
