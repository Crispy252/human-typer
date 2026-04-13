// Background service worker for native messaging

const NATIVE_HOST_NAME = 'com.schoology.ai.assistant';
let nativePort = null;
let pendingRequests = new Map();
let requestId = 0;

// Connect to native host
function connectNativeHost() {
  if (nativePort) {
    return nativePort;
  }

  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);

    nativePort.onMessage.addListener((message) => {
      console.log('Received from native host:', message);

      // Handle response
      if (message.requestId && pendingRequests.has(message.requestId)) {
        const callback = pendingRequests.get(message.requestId);
        callback(message);
        pendingRequests.delete(message.requestId);
      }
    });

    nativePort.onDisconnect.addListener(() => {
      console.log('Native host disconnected');
      if (chrome.runtime.lastError) {
        console.error('Native host error:', chrome.runtime.lastError.message);
      }
      nativePort = null;

      // Reject all pending requests
      for (const [id, callback] of pendingRequests.entries()) {
        callback({ error: 'Native host disconnected' });
      }
      pendingRequests.clear();
    });

    return nativePort;
  } catch (error) {
    console.error('Failed to connect to native host:', error);
    return null;
  }
}

// Send message to native host
function sendToNativeHost(message, callback) {
  const port = connectNativeHost();

  if (!port) {
    callback({ error: 'Failed to connect to native host' });
    return;
  }

  const reqId = ++requestId;
  message.requestId = reqId;
  pendingRequests.set(reqId, callback);

  try {
    port.postMessage(message);

    // Timeout after 60 seconds
    setTimeout(() => {
      if (pendingRequests.has(reqId)) {
        pendingRequests.delete(reqId);
        callback({ error: 'Request timeout' });
      }
    }, 60000);
  } catch (error) {
    pendingRequests.delete(reqId);
    callback({ error: error.message });
  }
}

// Track which tabs have the debugger attached
const debuggerTabs = new Set();

chrome.debugger.onDetach.addListener((source) => {
  debuggerTabs.delete(source.tabId);
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);

  // --- Chrome Debugger API handlers for typing simulator ---

  if (request.type === 'DEBUGGER_ATTACH') {
    const tabId = sender.tab.id;
    if (debuggerTabs.has(tabId)) {
      sendResponse({ success: true });
      return true;
    }
    chrome.debugger.attach({ tabId }, '1.3', () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        debuggerTabs.add(tabId);
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (request.type === 'DEBUGGER_INSERT_TEXT') {
    const tabId = sender.tab.id;
    chrome.debugger.sendCommand({ tabId }, 'Input.insertText', { text: request.text }, () => {
      sendResponse({ success: !chrome.runtime.lastError });
    });
    return true;
  }

  if (request.type === 'DEBUGGER_KEY_EVENT') {
    const tabId = sender.tab.id;
    chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', request.params, () => {
      sendResponse({ success: !chrome.runtime.lastError });
    });
    return true;
  }

  if (request.type === 'DEBUGGER_DETACH') {
    const tabId = sender.tab.id;
    if (!debuggerTabs.has(tabId)) {
      sendResponse({ success: true });
      return true;
    }
    chrome.debugger.detach({ tabId }, () => {
      debuggerTabs.delete(tabId);
      sendResponse({ success: true });
    });
    return true;
  }

  // --- End debugger handlers ---

  if (request.type === 'TEST_CONNECTION') {
    sendToNativeHost({ type: 'ping' }, (response) => {
      sendResponse({ success: !response.error, response });
    });
    return true; // Will respond asynchronously
  }

  if (request.type === 'PROCESS_ASSIGNMENT') {
    // Get API key from storage
    chrome.storage.local.get(['apiKey'], (result) => {
      if (!result.apiKey) {
        sendResponse({ error: 'API key not configured' });
        return;
      }

      // Send to native host for processing
      sendToNativeHost({
        type: 'process_assignment',
        apiKey: result.apiKey,
        assignment: request.assignment
      }, (response) => {
        // Update completed count
        if (response.success) {
          chrome.storage.local.get(['completedCount'], (result) => {
            const count = (result.completedCount || 0) + 1;
            chrome.storage.local.set({ completedCount: count });
          });
        }

        sendResponse(response);
      });
    });
    return true; // Will respond asynchronously
  }

  return false;
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Schoology AI Assistant installed');
});
