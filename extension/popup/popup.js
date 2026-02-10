// Popup script for Schoology AI Assistant

const statusDiv = document.getElementById('status');
const apiKeyInput = document.getElementById('apiKey');
const saveConfigButton = document.getElementById('saveConfig');
const completedCountSpan = document.getElementById('completedCount');
const backendStatusSpan = document.getElementById('backendStatus');

// Load saved configuration
chrome.storage.local.get(['apiKey', 'completedCount'], (result) => {
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }
  if (result.completedCount) {
    completedCountSpan.textContent = result.completedCount;
  }
});

// Save configuration
saveConfigButton.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    alert('Please enter a valid OpenAI API key');
    return;
  }

  if (!apiKey.startsWith('sk-')) {
    alert('OpenAI API keys should start with "sk-"');
    return;
  }

  chrome.storage.local.set({ apiKey }, () => {
    statusDiv.className = 'status connected';
    statusDiv.textContent = '✓ Configuration saved successfully';

    // Test connection to backend
    testBackendConnection();
  });
});

// Test backend connection
function testBackendConnection() {
  chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' }, (response) => {
    if (chrome.runtime.lastError) {
      backendStatusSpan.textContent = 'Not connected';
      statusDiv.className = 'status error';
      statusDiv.textContent = '✗ Backend not connected. Please install the native host.';
      return;
    }

    if (response && response.success) {
      backendStatusSpan.textContent = 'Connected';
      statusDiv.className = 'status connected';
      statusDiv.textContent = '✓ Backend connected';
    } else {
      backendStatusSpan.textContent = 'Error';
      statusDiv.className = 'status error';
      statusDiv.textContent = '✗ Backend connection failed';
    }
  });
}

// Test connection on load
testBackendConnection();

// Update stats periodically
setInterval(() => {
  chrome.storage.local.get(['completedCount'], (result) => {
    if (result.completedCount) {
      completedCountSpan.textContent = result.completedCount;
    }
  });
}, 2000);
