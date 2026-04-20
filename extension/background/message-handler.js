/**
 * Human Typer — Background Service Worker
 * Bridges content script requests to the Chrome Debugger Protocol (CDP).
 * CDP events are browser-trusted — Google Docs responds to them, unlike
 * synthetic JS events (isTrusted: false) which Docs ignores.
 *
 * Also handles:
 *  - Keyboard shortcut (Ctrl+Shift+Y / Cmd+Shift+Y) → SHORTCUT_START
 *  - Right-click context menu on editable fields → SHORTCUT_START
 *  - License verification via Gumroad API
 */

const debuggerTabs = new Set();

// ── Context menu ──────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'human-typer-start',
    title: 'Type with Human Typer ✦',
    contexts: ['editable'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'human-typer-start' && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'SHORTCUT_START' });
  }
});

// ── Keyboard shortcut ─────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener((command) => {
  if (command === 'start-typing') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SHORTCUT_START' });
      }
    });
  }
});

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

  if (request.type === 'LICENSE_VERIFY') {
    // TODO: Replace YOUR_PRODUCT_ID with your Gumroad product_id
    // Find it in your Gumroad dashboard → the product URL slug
    // e.g. if your product is at gumroad.com/l/human-typer, the product_id is "human-typer"
    const GUMROAD_PRODUCT_ID = 'YOUR_PRODUCT_ID'; // TODO: set your Gumroad product_id
    fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_id: GUMROAD_PRODUCT_ID,
        license_key: request.licenseKey,
        increment_uses_count: 'false',
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          sendResponse({ valid: true });
        } else {
          sendResponse({ valid: false, error: data.message || 'Invalid license key.' });
        }
      })
      .catch(err => sendResponse({ valid: false, error: err.message }));
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
