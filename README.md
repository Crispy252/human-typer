# TypeCloak

**Invisible typing. Human results.**

TypeCloak is a Chrome extension that types your text into Google Docs, Canvas, Blackboard, Moodle, and more — character by character, over a duration you set, with burst patterns, self-correcting typos, a fatigue curve, and stealth mode. It is indistinguishable from real human typing.

No API keys. No accounts. No data leaves your browser.

<img width="1382" height="674" alt="Image" src="https://github.com/user-attachments/assets/86b4380a-1a78-4480-a850-82598e9a823c" />
---

## Install

1. Clone or download this repo.
2. Go to `chrome://extensions/` and enable **Developer Mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/` folder.
4. Open any supported page — the **TypeCloak** panel appears in the top-right corner.
5. Use **Ctrl+Shift+Y** (or **Cmd+Shift+Y** on Mac) to open the panel and start typing from anywhere. Right-click any editable field and choose **Type with TypeCloak ✦** to do the same.

---

## Supported platforms

| Platform | Coverage |
|---|---|
| Google Docs | Full support (all document types) |
| Google Slides | Full support |
| Google Forms | Full support |
| Canvas LMS | Full support |
| Blackboard | Full support |
| Moodle | Full support |

---

## How to use

1. Paste your text into the **Text to type** box.
2. Pick a **Speed preset** (Slow / Casual / Normal / Quick / Fast) — duration is calculated automatically from word count, or set it manually.
3. Toggle any premium features you want (Stealth Mode, Fatigue Curve, Smart Error Zones).
4. Click **▶ Start**. You have 3 seconds to click inside the document and place your cursor exactly where you want typing to begin.
5. Use **⏸ Pause / ▶ Resume** or **⏹ Stop** at any time. If you stop mid-session, TypeCloak offers to **Resume** from where it left off the next time you open the panel.
6. Click **◎** in the header to enter **Focus Mode** — the panel collapses to a minimal floating progress ring so it stays out of your way.

---

## Settings

### Speed presets

| Preset | WPM | Variability | Typo rate |
|---|---|---|---|
| Slow | 25 | 20% | 2% |
| Casual | 45 | 35% | 3% |
| Normal | 65 | 45% | 4% |
| Quick | 90 | 60% | 6% |
| Fast | 120 | 75% | 8% |

Duration is auto-calculated from your text length and chosen WPM. You can override it manually.

### Manual controls

| Setting | What it does |
|---|---|
| **Duration (min)** | Total time the session should last. TypeCloak paces itself to finish exactly within this window using drift correction. |
| **Speed variability** | How much per-keystroke delay varies. 0% = perfectly even; 100% = very erratic. ~40% is natural. |
| **Typo rate** | Probability of hitting a wrong adjacent QWERTY key. TypeCloak notices after 0–4 characters and backspaces to fix it. 3% is subtle; 8%+ is noticeable. |

### Premium features

| Feature | What it does |
|---|---|
| **Stealth Mode** | Adds micro-hesitations inside bursts and 0.8–2.8 s reading pauses after paragraph breaks — makes keystroke-timing analysis fail. |
| **Fatigue Curve** | Speed decays exponentially over the session (up to 35% slower by the end). Completely natural — no real person types at constant speed for 30 minutes. |
| **Smart Error Zones** | Typo probability follows a bell curve peaking at 40–60% through each word, matching real QWERTY error patterns. Mid-word misses are far more common than first/last-character errors. |
| **Text Presets** | Save up to 5 texts and reload them instantly. |
| **Typing Profiles** | Save up to 5 named settings configurations (speed, variability, typo rate, all toggles). |

---

## Free vs Paid

| | Free | Starter | Pro | Max |
|---|---|---|---|---|
| Sessions per day | 3 | Unlimited | Unlimited | Unlimited |
| Characters per session | 500 | Unlimited | Unlimited | Unlimited |
| Speed presets | ✓ | ✓ | ✓ | ✓ |
| Sentence Intelligence | ✓ | ✓ | ✓ | ✓ |
| Resume from interruption | ✓ | ✓ | ✓ | ✓ |
| Focus Mode | ✓ | ✓ | ✓ | ✓ |
| Stealth Mode | — | ✓ | ✓ | ✓ |
| Fatigue Curve | — | ✓ | ✓ | ✓ |
| Smart Error Zones | — | — | ✓ | ✓ |
| Text Presets (×5) | — | — | ✓ | ✓ |
| Typing Profiles (×5) | — | — | ✓ | ✓ |
| Priority support | — | — | — | ✓ |

**Starter** — $2.99/month · **Pro** — $4.99/month · **Max** — $9.99/month

All plans via Gumroad. Cancel anytime. Enter your license key in the panel to unlock instantly.

---

## How it works

Google Docs (and most LMS editors) ignore synthetic browser events because they have `isTrusted: false`. TypeCloak works around this using the **Chrome Debugger Protocol (CDP)** to fire real, browser-trusted `Input.dispatchKeyEvent` commands — the same mechanism Chrome DevTools uses internally. This is the only reliable way to inject keystrokes into Google Docs from an extension without a native app.

### Typing engine

**Rhythm**
- Characters are typed in short *bursts* (Poisson-distributed, mean ~10 chars), separated by 300–1500 ms thinking pauses.
- Per-keystroke delay is jittered using a CLT-approximated normal distribution (sum of 3 uniform samples).
- A drift-correction loop tracks elapsed vs. target time and adjusts each delay to keep the session on schedule.

**Sentence Intelligence**
- After `.`, `?`, or `!` followed by a space, TypeCloak pauses 250–900 ms before the next sentence — scaled to stay within the overall duration budget.

**Typos**
- A wrong QWERTY-adjacent key is typed, then after 0–4 characters TypeCloak pauses (~400 ms), backspaces to the error, and retypes the correct characters at a slightly faster "correction" speed.
- With **Smart Error Zones** on, typo probability peaks mid-word using a Gaussian curve — far more realistic than uniform random errors.

**Fatigue Curve**
- With **Fatigue Curve** on, the base keystroke delay is multiplied by `1 + 0.35 × (e^(2p) − 1) / (e² − 1)` where `p` is progress 0→1. This produces a natural exponential slowdown — barely noticeable at first, obvious by the end of a long session.

**Stealth Mode**
- After every `\n`, TypeCloak sleeps 800–2800 ms to simulate re-reading what was typed.
- Inside bursts, there is a 6% chance of a 100–450 ms micro-hesitation.

### Resume from interruption
- Position is saved to `chrome.storage.session` every 15 characters and on every pause.
- If the session is stopped, the saved state is preserved. On the next panel open, a banner offers to resume with the chars-remaining count shown.
- State expires after 24 hours and is cleared on clean session completion.

### Permissions used

| Permission | Why |
|---|---|
| `debugger` | Attach CDP to send trusted keypresses |
| `storage` | Save license key, presets, profiles, and resume state |
| `contextMenus` | "Type with TypeCloak ✦" right-click menu on editable fields |

> While TypeCloak is typing, Chrome displays a **"Chrome is being debugged"** banner at the top of the page. This is a Chrome security feature and cannot be suppressed. It disappears as soon as typing finishes or is stopped.

---

## Keyboard shortcut

**Ctrl+Shift+Y** (Windows/Linux) · **Cmd+Shift+Y** (Mac)

Opens the TypeCloak panel and immediately triggers Start if the panel was already open. Also available by right-clicking any editable field.

---

## Privacy

TypeCloak runs entirely locally. The only outbound network request is the optional Gumroad license verification call (`POST https://api.gumroad.com/v2/licenses/verify`) when you enter a license key. Your text is never transmitted anywhere.
