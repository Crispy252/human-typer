/**
 * TypeCloak — Background Service Worker
 * Bridges content script requests to the Chrome Debugger Protocol (CDP).
 * CDP events are browser-trusted — Google Docs responds to them, unlike
 * synthetic JS events (isTrusted: false) which Docs ignores.
 *
 * Also handles:
 *  - Keyboard shortcut (Ctrl+Shift+Y / Cmd+Shift+Y) → SHORTCUT_START
 *  - Right-click context menu on editable fields → SHORTCUT_START
 *  - License verification via Gumroad API
 *  - Referral program (REFERRAL_GENERATE, REFERRAL_CLAIM, REFERRAL_STATUS)
 */

const debuggerTabs = new Set();

// ── Supabase ───────────────────────────────────────────────────────────────────
// TODO: Replace with your Supabase project URL and anon key after creating the
// project at supabase.com. The anon key is safe to use here — RLS is disabled
// and the table only stores anonymous install IDs (random UUIDs).
const SUPABASE_URL      = 'TODO_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'TODO_SUPABASE_ANON_KEY';

const SUPABASE_HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
};

// ── Referral helpers ───────────────────────────────────────────────────────────

async function getOrCreateInstallId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['installId'], (data) => {
      if (data.installId) return resolve(data.installId);
      const id = crypto.randomUUID();
      chrome.storage.local.set({ installId: id });
      resolve(id);
    });
  });
}

/**
 * Extend the user's Pro access by `days` days.
 * Stacks on top of any existing expiry rather than resetting it.
 * Also sets tier:'pro' so the session check grants full access.
 */
async function grantProDays(days) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['proExpiresAt'], (data) => {
      const now     = Date.now();
      const current = (data.proExpiresAt && data.proExpiresAt > now)
        ? data.proExpiresAt
        : now;
      const newExpiry = current + days * 24 * 60 * 60 * 1000;
      chrome.storage.local.set({ proExpiresAt: newExpiry, tier: 'pro' }, () => resolve(newExpiry));
    });
  });
}

// ── Context menu ──────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.create({
    id: 'human-typer-start',
    title: 'Type with TypeCloak ✦',
    contexts: ['editable'],
  });

  // On first install, set a flag so the panel can prompt for a referral code
  if (details.reason === 'install') {
    chrome.storage.local.set({ isFirstInstall: true });
  }
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

  // ── CDP: Attach ─────────────────────────────────────────────────────────────
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

  // ── CDP: Key event ──────────────────────────────────────────────────────────
  if (request.type === 'DEBUGGER_KEY_EVENT') {
    const tabId = sender.tab.id;
    chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', request.params, () => {
      sendResponse({ success: !chrome.runtime.lastError });
    });
    return true;
  }

  // ── CDP: Mouse event ────────────────────────────────────────────────────────
  if (request.type === 'DEBUGGER_MOUSE_EVENT') {
    const tabId = sender.tab.id;
    chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', request.params, () => {
      sendResponse({ success: !chrome.runtime.lastError });
    });
    return true;
  }

  // ── CDP: Detach ─────────────────────────────────────────────────────────────
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

  // ── License verify ──────────────────────────────────────────────────────────
  if (request.type === 'LICENSE_VERIFY') {
    const GUMROAD_PRODUCT_ID = 'fcENKDsW2HowDVJjt3Ppnw==';
    const TIER_MAP = { starter: 'starter', pro: 'pro', max: 'max' };

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
        if (!data.success) {
          sendResponse({ valid: false, error: data.message || 'Invalid license key.' });
          return;
        }
        const p = data.purchase || {};
        if (p.cancelled || p.chargebacked || p.subscription_cancelled_at || p.subscription_failed_at) {
          sendResponse({ valid: false, error: 'Your TypeCloak subscription is no longer active. Resubscribe at gumroad.com to continue.' });
          return;
        }
        const variantTier = p.variants ? p.variants.replace(/[()]/g, '').trim() : '';
        const rawTier = variantTier || (p.tier && p.tier.name) || p.plan_name || '';
        const tier = TIER_MAP[rawTier.toLowerCase()] || 'starter';
        sendResponse({ valid: true, tier });
      })
      .catch(err => sendResponse({ valid: false, error: err.message }));
    return true;
  }

  // ── Referral: Generate ──────────────────────────────────────────────────────
  // Returns the user's referral code, creating it in Supabase on first call.
  if (request.type === 'REFERRAL_GENERATE') {
    (async () => {
      try {
        const installId = await getOrCreateInstallId();

        // Return cached code if already generated
        const local = await new Promise(r => chrome.storage.local.get(['referralCode'], r));
        if (local.referralCode) {
          sendResponse({ success: true, code: local.referralCode });
          return;
        }

        // Derive a short readable code from the install ID
        const code = installId.replace(/-/g, '').slice(0, 8).toUpperCase();

        // Check Supabase in case the code was already created (e.g. storage cleared)
        const checkRes = await fetch(
          `${SUPABASE_URL}/rest/v1/referrals?referral_code=eq.${code}&select=referral_code`,
          { headers: SUPABASE_HEADERS }
        );
        const existing = await checkRes.json();

        if (!existing.length) {
          // Insert new row
          await fetch(`${SUPABASE_URL}/rest/v1/referrals`, {
            method: 'POST',
            headers: { ...SUPABASE_HEADERS, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ referral_code: code, referrer_install_id: installId }),
          });
        }

        chrome.storage.local.set({ referralCode: code });
        sendResponse({ success: true, code });
      } catch (err) {
        // Fail silently — return a local-only code so the UI still works
        const local = await new Promise(r => chrome.storage.local.get(['installId'], r));
        const fallback = (local.installId || crypto.randomUUID()).replace(/-/g, '').slice(0, 8).toUpperCase();
        chrome.storage.local.set({ referralCode: fallback });
        sendResponse({ success: true, code: fallback });
      }
    })();
    return true;
  }

  // ── Referral: Claim ─────────────────────────────────────────────────────────
  // Called when a new user enters a referral code. Grants Pro days to both parties.
  if (request.type === 'REFERRAL_CLAIM') {
    (async () => {
      try {
        const code      = (request.code || '').trim().toUpperCase();
        const installId = await getOrCreateInstallId();

        if (!code) {
          sendResponse({ success: false, reason: 'empty_code' });
          return;
        }

        // Check if this install already claimed a code
        const localData = await new Promise(r => chrome.storage.local.get(['referralClaimed'], r));
        if (localData.referralClaimed) {
          sendResponse({ success: false, reason: 'already_claimed' });
          return;
        }

        // Look up unclaimed row in Supabase
        const res  = await fetch(
          `${SUPABASE_URL}/rest/v1/referrals?referral_code=eq.${code}&claimed=eq.false&select=*`,
          { headers: SUPABASE_HEADERS }
        );
        const rows = await res.json();

        if (!rows.length) {
          sendResponse({ success: false, reason: 'invalid_or_used' });
          return;
        }

        const row = rows[0];

        // Block self-referral
        if (row.referrer_install_id === installId) {
          sendResponse({ success: false, reason: 'self_referral' });
          return;
        }

        // Mark as claimed
        await fetch(`${SUPABASE_URL}/rest/v1/referrals?id=eq.${row.id}`, {
          method:  'PATCH',
          headers: { ...SUPABASE_HEADERS, 'Prefer': 'return=minimal' },
          body:    JSON.stringify({
            claimed:              true,
            referred_install_id:  installId,
            claimed_at:           new Date().toISOString(),
          }),
        });

        // Grant +3 Pro days to the new user
        const expiresAt = await grantProDays(3);

        // Mark locally so this install can't claim again
        chrome.storage.local.set({ referralClaimed: true });

        sendResponse({ success: true, proExpiresAt: expiresAt });
      } catch (err) {
        sendResponse({ success: false, reason: 'error', error: err.message });
      }
    })();
    return true;
  }

  // ── Referral: Status ────────────────────────────────────────────────────────
  // Polls Supabase for new referral completions and grants Pro days to the referrer.
  // Rate-limited client-side to once per hour.
  if (request.type === 'REFERRAL_STATUS') {
    (async () => {
      try {
        const installId = await getOrCreateInstallId();

        // Rate limit: skip if checked within the last hour
        const localData = await new Promise(r =>
          chrome.storage.local.get(['lastReferralCheck', 'referralRewardsClaimed'], r)
        );
        const hourAgo = Date.now() - 60 * 60 * 1000;
        if (localData.lastReferralCheck && localData.lastReferralCheck > hourAgo) {
          // Return cached counts without hitting Supabase
          const cached = await new Promise(r =>
            chrome.storage.local.get(['referralCount', 'referralDaysEarned'], r)
          );
          sendResponse({
            success:    true,
            newRewards: 0,
            totalReferrals: cached.referralCount    || 0,
            daysEarned:     cached.referralDaysEarned || 0,
          });
          return;
        }

        // Query all claimed referrals for this user
        const res  = await fetch(
          `${SUPABASE_URL}/rest/v1/referrals?referrer_install_id=eq.${installId}&claimed=eq.true&select=id`,
          { headers: SUPABASE_HEADERS }
        );
        const rows = await res.json();

        const totalInDB      = rows.length;
        const prevClaimed    = localData.referralRewardsClaimed || 0;
        const newRewards     = Math.max(0, totalInDB - prevClaimed);
        const daysEarned     = totalInDB * 7;

        if (newRewards > 0) {
          await grantProDays(newRewards * 7);
          chrome.storage.local.set({
            referralRewardsClaimed: totalInDB,
            referralCount:          totalInDB,
            referralDaysEarned:     daysEarned,
            lastReferralCheck:      Date.now(),
          });
        } else {
          chrome.storage.local.set({
            referralCount:      totalInDB,
            referralDaysEarned: daysEarned,
            lastReferralCheck:  Date.now(),
          });
        }

        sendResponse({ success: true, newRewards, totalReferrals: totalInDB, daysEarned });
      } catch (err) {
        // Fail silently — return zeros so the UI doesn't break
        sendResponse({ success: false, newRewards: 0, totalReferrals: 0, daysEarned: 0 });
      }
    })();
    return true;
  }

  return false;
});
