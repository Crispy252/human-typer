# Schoology AI Assistant

An AI-powered browser extension that integrates with Schoology to assist with assignments using OpenAI GPT-4.

## ⚠️ Important Notice

This tool is designed for **educational assistance and research purposes**. Users must:
- Check their institution's academic integrity policies before use
- Use responsibly and ethically
- Consider this as a learning aid, not a replacement for learning
- Be aware that use may violate academic policies at some institutions

## Features

- **Quiz Auto-Completion**: Automatically answer multiple choice, true/false, and short answer questions
- **Essay Generation**: Generate well-structured essays based on assignment prompts
- **Discussion Posts**: Create thoughtful discussion board responses
- **Smart Detection**: Automatically detects assignment types on Schoology pages
- **Configurable**: Customize AI behavior and response settings

## Architecture

The system uses a hybrid architecture:
- **Browser Extension** (JavaScript): Frontend UI, DOM manipulation, and Schoology integration
- **Python Backend**: AI processing using OpenAI GPT-4 via native messaging

## Prerequisites

- Python 3.8 or higher
- Google Chrome or Microsoft Edge browser
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## Installation

### Step 1: Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Step 2: Install Native Messaging Host

```bash
python install_native_host.py
```

This will:
- Install the native messaging host manifest
- Display the location of the manifest file
- Show next steps for configuration

### Step 3: Load Browser Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension` directory
5. Copy the **Extension ID** from the extension card

### Step 4: Update Native Host Manifest

1. Open the native host manifest file (path shown during installation)
2. Replace `EXTENSION_ID_HERE` with your actual Extension ID
3. Save the file

### Step 5: Configure API Key

1. Click the extension icon in Chrome
2. Enter your OpenAI API key in the popup
3. Click **Save Configuration**
4. Verify that "Backend connected" shows in the popup

## Usage

1. Navigate to a Schoology assignment page (quiz, essay, or discussion)
2. Wait for the page to fully load
3. Look for the **AI Auto-Complete** button (gradient purple button)
4. Click the button to process the assignment
5. Review and verify the generated responses
6. Submit when ready (the extension does not auto-submit)

## Project Structure

```
.
├── extension/              # Browser extension
│   ├── manifest.json      # Extension configuration
│   ├── background/        # Background service worker
│   ├── content/           # Content scripts and styles
│   └── popup/             # Extension popup UI
├── backend/               # Python backend
│   ├── native_host.py    # Native messaging host
│   ├── ai_handler.py     # OpenAI integration
│   ├── config.py         # Configuration
│   └── requirements.txt  # Python dependencies
├── install_native_host.py # Installation script
└── README.md             # This file
```

## Configuration

### Environment Variables

Create a `.env` file in the `backend` directory to customize settings:

```env
# OpenAI Settings
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_TEMPERATURE=0.7
MAX_TOKENS=2000

# Response Settings
MIN_ESSAY_WORDS=250
MAX_ESSAY_WORDS=1000
MIN_DISCUSSION_WORDS=100
MAX_DISCUSSION_WORDS=300

# Logging
LOG_LEVEL=INFO
LOG_FILE=schoology_ai.log
```

### Logs

Logs are stored at `~/.schoology_ai/schoology_ai.log`

## Troubleshooting

### Extension can't connect to backend

1. Verify the native host manifest is installed correctly
2. Check that the Extension ID in the manifest matches your extension
3. Ensure Python dependencies are installed
4. Check logs at `~/.schoology_ai/schoology_ai.log`

### API errors

1. Verify your OpenAI API key is valid
2. Check your OpenAI account has credits
3. Review rate limits on your OpenAI account

### Button doesn't appear

1. Ensure you're on a Schoology assignment page
2. Refresh the page
3. Check browser console for errors (F12 → Console)

## Development

### Testing the Native Messaging Connection

```bash
cd backend
python -c "from native_host import NativeMessagingHost; host = NativeMessagingHost(); print('Host initialized successfully')"
```

### Manual Testing

1. Open the extension popup and check connection status
2. Navigate to a test assignment on Schoology
3. Open browser DevTools (F12) → Console tab
4. Look for log messages from the extension

## Uninstallation

```bash
python install_native_host.py uninstall
```

Then remove the extension from `chrome://extensions/`

## Security & Privacy

- API keys are stored locally in Chrome's storage
- No data is sent to external servers except OpenAI's API
- Assignment data is only used for generating responses
- All communication between extension and backend is local

## License

This project is for educational purposes only. Use at your own risk.

## Disclaimer

The creators of this tool are not responsible for any academic integrity violations or consequences resulting from its use. Always comply with your institution's policies and use this tool responsibly.
