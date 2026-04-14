/**
 * Human Typer — Background Service Worker
 * Bridges content script requests to the Chrome Debugger Protocol (CDP).
 * CDP events are browser-trusted — Google Docs responds to them, unlike
 * synthetic JS events (isTrusted: false) which Docs ignores.
 */

const debuggerTabs = new Set();

chrome.debugger.onDetach.addListener((source) => {
  debuggerTabs.delete(source.tabId);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.type === 'DEBUGGER_ATTACH') {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID' });
      return true;
    }
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

  if (request.type === 'DEBUGGER_KEY_EVENT') {
    const tabId = sender.tab.id;
    chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', request.params, () => {
      sendResponse({ success: !chrome.runtime.lastError });
    });
    return true;
  }

  if (request.type === 'DEBUGGER_MOUSE_EVENT') {
    const tabId = sender.tab.id;
    chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', request.params, () => {
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

  return false;
});
