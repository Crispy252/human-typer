# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Schoology AI Assistant is a browser extension that uses OpenAI GPT-4 to help complete assignments on the Schoology learning platform. It uses a hybrid architecture:

- **Browser Extension** (JavaScript/Chrome APIs): Detects assignments, injects UI, handles user interaction
- **Python Backend** (Native Messaging): Processes assignments using OpenAI API, handles AI logic

Communication between extension and backend happens via Chrome Native Messaging protocol (JSON over stdin/stdout).

## Key Architecture Patterns

### Native Messaging Flow
1. Content script detects assignment → sends to background service worker
2. Background worker (`message-handler.js`) forwards to Python backend via `chrome.runtime.connectNative()`
3. Python `native_host.py` reads JSON from stdin, processes via `ai_handler.py`, writes response to stdout
4. Background worker receives response and sends back to content script
5. Content script fills in answers on page

### Assignment Detection System
- `schoology-detector.js` uses DOM selectors to identify assignment types (quiz/essay/discussion)
- Detection is URL-based + DOM inspection (e.g., `/quiz/` path + `.question-item` elements)
- Each assignment type has specific parsing logic to extract questions, prompts, and options
- Returns structured data with element references for later manipulation

### AI Processing
- `ai_handler.py` contains all OpenAI integration logic
- Different prompt strategies for each assignment type:
  - **Quizzes**: Process questions individually, select best option with low temperature (0.3)
  - **Essays**: Generate structured content based on requirements (word count, citations)
  - **Discussions**: Context-aware responses that reference existing posts
- Error handling and logging at each step

## Common Development Commands

### Install Dependencies
```bash
# Python backend
cd backend
pip install -r requirements.txt

# No npm dependencies for extension (vanilla JS)
```

### Setup Native Messaging Host
```bash
# Install host manifest (macOS/Linux)
python install_native_host.py

# Uninstall
python install_native_host.py uninstall
```

### Load Extension for Testing
1. Navigate to `chrome://extensions/`
2. Enable Developer Mode
3. Click "Load unpacked" → select `extension/` directory
4. Copy Extension ID and update in native host manifest

### Testing

**Test Native Host Connection**:
```bash
cd backend
echo '{"type":"ping","requestId":1}' | python native_host.py
# Should output length bytes + JSON response
```

**Test AI Handler**:
```python
from ai_handler import AIHandler
handler = AIHandler("sk-your-key")
result = handler.process_quiz({"questions": [...]})
```

**Test Extension**:
1. Load extension in Chrome
2. Configure API key in popup
3. Navigate to Schoology test assignment
4. Check browser console (F12) for log messages
5. Click "AI Auto-Complete" button
6. Verify backend communication in `~/.schoology_ai/schoology_ai.log`

### Logs and Debugging
- Python logs: `~/.schoology_ai/schoology_ai.log`
- Extension logs: Browser DevTools Console (F12)
- Native messaging errors: `chrome://extensions/` → extension details → "Inspect views"

## Critical Files

### Extension Core
- `extension/manifest.json` - Extension configuration, permissions, content scripts
- `extension/background/message-handler.js` - Native messaging client, request routing
- `extension/content/schoology-detector.js` - Assignment detection and parsing
- `extension/content/ui-injector.js` - UI injection and answer filling

### Backend Core
- `backend/native_host.py` - Native messaging host entry point (reads/writes binary protocol)
- `backend/ai_handler.py` - OpenAI integration, prompt engineering for each assignment type
- `backend/config.py` - Configuration management with sensible defaults

### Infrastructure
- `install_native_host.py` - Native host installation/uninstallation script

## Making Changes

### Adding Support for New Assignment Types
1. Update `SchoologyDetector.detectAssignmentType()` to recognize new type
2. Add parser method (e.g., `parseLabReport()`)
3. Add processor method in `AIHandler` (e.g., `process_lab_report()`)
4. Update `UIInjector.fillAnswers()` to handle new type's DOM manipulation

### Modifying AI Prompts
- Edit methods in `ai_handler.py` (`_answer_multiple_choice`, `process_essay`, etc.)
- Adjust temperature and max_tokens for different quality/creativity tradeoffs
- Test with real Schoology assignments to verify output quality

### Changing Extension UI
- Modify `extension/popup/popup.html` for popup interface
- Edit `extension/content/styles.css` for injected button/overlay styling
- Update `ui-injector.js` for different injection points or overlay behavior

### Configuration Changes
- Add new settings to `backend/config.py`
- Document in `backend/.env.example`
- Update README.md configuration section

## Security Considerations

- API keys are stored in Chrome's local storage (encrypted at rest by browser)
- Never log API keys or assignment content at INFO level
- Native messaging manifest must specify exact Extension ID (no wildcards)
- OpenAI API calls should validate input length to prevent excessive token usage

## Common Issues

**Extension can't connect to backend**:
- Check Extension ID in native host manifest matches actual ID
- Verify `native_host.py` is executable (`chmod +x`)
- Check manifest path: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.schoology.ai.assistant.json` (macOS)

**Button doesn't appear on Schoology**:
- Verify content scripts are injecting (check DevTools → Network)
- Check if Schoology changed their DOM structure (update selectors in `schoology-detector.js`)
- Ensure `run_at: document_idle` in manifest.json

**AI responses are poor quality**:
- Adjust temperature in `config.py` or per-method in `ai_handler.py`
- Improve prompts with more specific instructions or examples
- Consider switching to GPT-4 (update `OPENAI_MODEL` in config)

## Code Style

- **Python**: Follow PEP 8, use type hints, docstrings for all public methods
- **JavaScript**: ES6+ features, clear variable names, JSDoc comments for complex functions
- **Error Handling**: Always catch and log errors with context, return user-friendly messages
