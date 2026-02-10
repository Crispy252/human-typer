// Schoology Assignment Detector
// Detects and parses different types of assignments on Schoology

class SchoologyDetector {
  constructor() {
    this.currentAssignment = null;
  }

  // Detect assignment type based on URL and page content
  detectAssignmentType() {
    const url = window.location.href;
    const pathname = window.location.pathname;

    // Quiz/Test detection
    if (pathname.includes('/quiz/') || pathname.includes('/test/')) {
      return this.detectQuiz() ? 'quiz' : null;
    }

    // Assignment submission detection
    if (pathname.includes('/assignment/') && document.querySelector('.submit-assignment')) {
      return 'essay';
    }

    // Discussion detection
    if (pathname.includes('/discussion/') || document.querySelector('.discussion-reply')) {
      return 'discussion';
    }

    return null;
  }

  // Parse quiz questions and answers
  detectQuiz() {
    const questions = [];
    const questionElements = document.querySelectorAll('.question-item, .quiz-question, [class*="question"]');

    if (questionElements.length === 0) {
      return null;
    }

    questionElements.forEach((elem, index) => {
      const questionText = this.extractQuestionText(elem);
      const options = this.extractQuestionOptions(elem);
      const questionType = this.detectQuestionType(elem);

      if (questionText) {
        questions.push({
          index,
          text: questionText,
          type: questionType,
          options: options,
          element: elem
        });
      }
    });

    return questions.length > 0 ? {
      type: 'quiz',
      title: this.getPageTitle(),
      questions: questions
    } : null;
  }

  // Extract question text from element
  extractQuestionText(element) {
    // Try multiple selectors for question text
    const selectors = [
      '.question-text',
      '.question-title',
      '.question-content',
      '[class*="question-text"]',
      'h3',
      'h4'
    ];

    for (const selector of selectors) {
      const textElem = element.querySelector(selector);
      if (textElem) {
        return textElem.textContent.trim();
      }
    }

    // Fallback to first significant text
    const text = element.textContent.trim();
    if (text.length > 10) {
      return text.split('\n')[0].trim();
    }

    return null;
  }

  // Extract answer options for multiple choice
  extractQuestionOptions(element) {
    const options = [];

    // Look for radio buttons or checkboxes
    const inputs = element.querySelectorAll('input[type="radio"], input[type="checkbox"]');

    inputs.forEach((input) => {
      const label = this.findLabelForInput(input);
      if (label) {
        options.push({
          text: label.textContent.trim(),
          value: input.value,
          element: input
        });
      }
    });

    // If no inputs found, look for option divs
    if (options.length === 0) {
      const optionElements = element.querySelectorAll('.option, .answer-option, [class*="option"]');
      optionElements.forEach((opt) => {
        options.push({
          text: opt.textContent.trim(),
          element: opt
        });
      });
    }

    return options;
  }

  // Find label associated with input
  findLabelForInput(input) {
    // Try label with for attribute
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label;
    }

    // Try parent label
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel;

    // Try next sibling
    let sibling = input.nextElementSibling;
    while (sibling) {
      if (sibling.tagName === 'LABEL' || sibling.classList.contains('option-text')) {
        return sibling;
      }
      sibling = sibling.nextElementSibling;
    }

    return null;
  }

  // Detect question type (multiple choice, true/false, short answer, etc.)
  detectQuestionType(element) {
    const radioInputs = element.querySelectorAll('input[type="radio"]');
    const checkboxInputs = element.querySelectorAll('input[type="checkbox"]');
    const textarea = element.querySelector('textarea');
    const textInput = element.querySelector('input[type="text"]');

    if (radioInputs.length > 0) {
      // Check if true/false question
      if (radioInputs.length === 2) {
        const texts = Array.from(radioInputs).map(r => {
          const label = this.findLabelForInput(r);
          return label ? label.textContent.toLowerCase().trim() : '';
        });
        if (texts.includes('true') && texts.includes('false')) {
          return 'true_false';
        }
      }
      return 'multiple_choice';
    }

    if (checkboxInputs.length > 0) {
      return 'multiple_select';
    }

    if (textarea) {
      return 'long_answer';
    }

    if (textInput) {
      return 'short_answer';
    }

    return 'unknown';
  }

  // Parse essay assignment
  parseEssayAssignment() {
    const title = this.getPageTitle();
    const instructions = this.getAssignmentInstructions();
    const textarea = document.querySelector('textarea, .submission-text, [contenteditable="true"]');

    if (!textarea) {
      return null;
    }

    return {
      type: 'essay',
      title: title,
      instructions: instructions,
      element: textarea,
      requirements: this.extractRequirements(instructions)
    };
  }

  // Parse discussion assignment
  parseDiscussion() {
    const title = this.getPageTitle();
    const prompt = document.querySelector('.discussion-prompt, .discussion-question');
    const replyBox = document.querySelector('textarea[name*="reply"], .discussion-reply textarea');

    if (!replyBox) {
      return null;
    }

    // Get existing posts for context
    const existingPosts = [];
    document.querySelectorAll('.discussion-post, .comment').forEach((post) => {
      existingPosts.push({
        author: post.querySelector('.author, .username')?.textContent.trim(),
        content: post.querySelector('.post-content, .comment-text')?.textContent.trim()
      });
    });

    return {
      type: 'discussion',
      title: title,
      prompt: prompt?.textContent.trim() || '',
      element: replyBox,
      existingPosts: existingPosts.slice(0, 5) // Include up to 5 recent posts for context
    };
  }

  // Get page title
  getPageTitle() {
    const titleElement = document.querySelector('h1, .page-title, .assignment-title');
    return titleElement ? titleElement.textContent.trim() : document.title;
  }

  // Get assignment instructions
  getAssignmentInstructions() {
    const selectors = [
      '.assignment-description',
      '.instructions',
      '.description',
      '[class*="instruction"]'
    ];

    for (const selector of selectors) {
      const elem = document.querySelector(selector);
      if (elem) {
        return elem.textContent.trim();
      }
    }

    return '';
  }

  // Extract requirements from instructions (word count, formatting, etc.)
  extractRequirements(instructions) {
    const requirements = {};

    // Word count
    const wordCountMatch = instructions.match(/(\d+)\s*(?:-\s*(\d+))?\s*words?/i);
    if (wordCountMatch) {
      requirements.minWords = parseInt(wordCountMatch[1]);
      requirements.maxWords = wordCountMatch[2] ? parseInt(wordCountMatch[2]) : requirements.minWords * 1.5;
    }

    // Page count
    const pageCountMatch = instructions.match(/(\d+)\s*(?:-\s*(\d+))?\s*pages?/i);
    if (pageCountMatch) {
      requirements.minPages = parseInt(pageCountMatch[1]);
      requirements.maxPages = pageCountMatch[2] ? parseInt(pageCountMatch[2]) : requirements.minPages;
    }

    // Citations required
    if (/citation|reference|source/i.test(instructions)) {
      requirements.citationsRequired = true;
    }

    return requirements;
  }

  // Get current assignment data
  getCurrentAssignment() {
    const type = this.detectAssignmentType();

    if (!type) {
      return null;
    }

    switch (type) {
      case 'quiz':
        return this.detectQuiz();
      case 'essay':
        return this.parseEssayAssignment();
      case 'discussion':
        return this.parseDiscussion();
      default:
        return null;
    }
  }
}

// Export for use in ui-injector
window.schoologyDetector = new SchoologyDetector();
