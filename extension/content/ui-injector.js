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

    const assignment = window.schoologyDetector.getCurrentAssignment();

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
}

// Initialize UI injector
const uiInjector = new UIInjector();

// Inject button when page loads
function initialize() {
  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => uiInjector.injectAutoCompleteButton(), 1000);
    });
  } else {
    setTimeout(() => uiInjector.injectAutoCompleteButton(), 1000);
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
