// Google Docs/Slides Assignment Detector
// Detects and parses Google Docs/Slides assignments

class GoogleDocsDetector {
  constructor() {
    this.currentAssignment = null;
    this.isGoogleDoc = window.location.href.includes('docs.google.com/document');
    this.isGoogleSlides = window.location.href.includes('docs.google.com/presentation');
  }

  // Detect assignment type based on URL and content
  detectAssignmentType() {
    if (this.isGoogleDoc) {
      return 'google_doc';
    } else if (this.isGoogleSlides) {
      return 'google_slides';
    }
    return null;
  }

  // Parse Google Doc assignment
  parseGoogleDoc() {
    // Wait for doc to load
    const docBody = document.querySelector('.kix-pagesview, .kix-page');

    if (!docBody) {
      return null;
    }

    // Get document title
    const title = document.querySelector('.docs-title-input')?.value ||
                  document.title.replace(' - Google Docs', '');

    // Get existing content to understand context
    const existingContent = this.getDocumentText();

    // Try to find assignment instructions (usually at top or in comments)
    const instructions = this.extractInstructions(existingContent);

    // Check if document is mostly empty (assignment to complete)
    const wordCount = existingContent.trim().split(/\s+/).length;
    const isEmpty = wordCount < 50;

    return {
      type: 'google_doc',
      title: title,
      instructions: instructions,
      existingContent: existingContent,
      isEmpty: isEmpty,
      wordCount: wordCount,
      documentElement: docBody
    };
  }

  // Parse Google Slides assignment
  parseGoogleSlides() {
    const title = document.querySelector('.docs-title-input')?.value ||
                  document.title.replace(' - Google Slides', '');

    // Get all slides
    const slides = document.querySelectorAll('.punch-viewer-slide-view');
    const slideCount = slides.length;

    // Get speaker notes or comments for instructions
    const instructions = this.extractSlidesInstructions();

    return {
      type: 'google_slides',
      title: title,
      instructions: instructions,
      slideCount: slideCount,
      slides: slides,
      isEmpty: slideCount <= 1
    };
  }

  // Get all text from Google Doc
  getDocumentText() {
    const textElements = document.querySelectorAll('.kix-paragraphrenderer');
    const textContent = Array.from(textElements)
      .map(el => el.textContent)
      .join('\n');

    return textContent;
  }

  // Extract assignment instructions from document
  extractInstructions(content) {
    // Common instruction patterns
    const lines = content.split('\n');
    const instructions = [];

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].trim();

      // Look for instruction keywords
      if (line.match(/instructions?:/i) ||
          line.match(/assignment:/i) ||
          line.match(/prompt:/i) ||
          line.match(/directions?:/i) ||
          line.match(/task:/i) ||
          line.match(/write about:/i)) {
        // Include this line and next few lines
        instructions.push(...lines.slice(i, i + 5));
        break;
      }
    }

    // If no explicit instructions found, use first few lines as context
    if (instructions.length === 0) {
      instructions.push(...lines.slice(0, 3));
    }

    return instructions.join('\n').trim();
  }

  // Extract instructions from Google Slides
  extractSlidesInstructions() {
    // Check speaker notes
    const speakerNotes = document.querySelector('.punch-speaker-notes-editor');
    if (speakerNotes) {
      return speakerNotes.textContent.trim();
    }

    // Check comments
    const comments = document.querySelectorAll('.docos-anchoreddocoview-content');
    if (comments.length > 0) {
      return Array.from(comments)
        .map(c => c.textContent)
        .join('\n');
    }

    // Check first slide title
    const firstSlideTitle = document.querySelector('.punch-viewer-title');
    return firstSlideTitle ? firstSlideTitle.textContent : '';
  }

  // Detect requirements from instructions
  detectRequirements(instructions) {
    const requirements = {};

    // Word count
    const wordMatch = instructions.match(/(\d+)\s*(?:-\s*(\d+))?\s*words?/i);
    if (wordMatch) {
      requirements.minWords = parseInt(wordMatch[1]);
      requirements.maxWords = wordMatch[2] ? parseInt(wordMatch[2]) : requirements.minWords * 1.5;
    }

    // Page count
    const pageMatch = instructions.match(/(\d+)\s*(?:-\s*(\d+))?\s*pages?/i);
    if (pageMatch) {
      requirements.minPages = parseInt(pageMatch[1]);
      requirements.maxPages = pageMatch[2] ? parseInt(pageMatch[2]) : requirements.minPages;
    }

    // Slide count
    const slideMatch = instructions.match(/(\d+)\s*(?:-\s*(\d+))?\s*slides?/i);
    if (slideMatch) {
      requirements.minSlides = parseInt(slideMatch[1]);
      requirements.maxSlides = slideMatch[2] ? parseInt(slideMatch[2]) : requirements.minSlides;
    }

    // Citations
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

    let assignment;
    if (type === 'google_doc') {
      assignment = this.parseGoogleDoc();
    } else if (type === 'google_slides') {
      assignment = this.parseGoogleSlides();
    }

    if (assignment && assignment.instructions) {
      assignment.requirements = this.detectRequirements(assignment.instructions);
    }

    return assignment;
  }

  // Insert text into Google Doc at cursor
  insertTextIntoDoc(text) {
    // Find the active cursor location
    const canvas = document.querySelector('.kix-canvas');
    if (!canvas) return false;

    // Method 1: Try to use the document's text insertion
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      return true;
    }

    // Method 2: Simulate typing (more reliable for Google Docs)
    this.simulateTyping(text);
    return true;
  }

  // Simulate typing into Google Docs
  simulateTyping(text) {
    const canvas = document.querySelector('.kix-canvas');
    if (!canvas) return;

    // Focus the canvas
    canvas.click();

    // Create input events
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    });

    const textEvent = new TextEvent('textInput', {
      bubbles: true,
      cancelable: true,
      data: text
    });

    // Dispatch events
    canvas.dispatchEvent(inputEvent);
    canvas.dispatchEvent(textEvent);

    // Alternative: use execCommand (deprecated but works)
    document.execCommand('insertText', false, text);
  }
}

// Export for use in ui-injector
window.googleDocsDetector = new GoogleDocsDetector();
