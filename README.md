# Human Typer

A Chrome extension that types your text into Google Docs the way a human would — character by character, over a duration you set, with realistic burst patterns, variable speed, and self-correcting typos.

No API keys. No accounts. No data leaves your browser.

---

## Install

1. Clone or download this repo.
2. Go to `chrome://extensions/` and enable **Developer Mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/` folder.
4. Open any Google Doc you have edit access to — the **Human Typer** panel will appear in the top-right corner.

---

## How to use

1. Paste your text into the **Text to type** box.
2. Set the **Duration** — how many minutes the typing should take.
3. Adjust **Speed variability** and **Typo rate** to taste.
4. Click **Start**. You have 3 seconds to click inside your Google Doc.
5. Watch it type. Use **Pause** / **Resume** or **Stop** at any time.

---

## Settings

| Setting | What it does |
|---|---|
| **Duration (minutes)** | Total time the typing session should last. The extension paces itself to finish within this window. |
| **Speed variability** | How much the per-keystroke delay varies. 0% = perfectly even; 100% = very erratic. 40% is a natural default. |
| **Typo rate** | Probability of hitting an adjacent wrong key. The extension notices the mistake after 0–4 characters and backspaces to fix it, just like a real person. 3% is subtle; 10%+ is noticeable. |
---
[<img src="https://i.postimg.cc/kBpsLngd/Screenshot-2026-04-16-at-11-03-51-AM.png" width="800">
](https://imgur.com/a/CW2BZRB)

## How it works

Google Docs ignores synthetic browser events (`isTrusted: false`). Human Typer works around this by using the **Chrome Debugger Protocol (CDP)** to fire real, trusted `Input.dispatchKeyEvent` commands — the same mechanism Chrome DevTools uses internally. This is the only reliable way to inject keystrokes into Google Docs from an extension.

**Typing rhythm:**
- Characters are typed in short *bursts* (Poisson-distributed, ~10 chars each), separated by 300–1500 ms thinking pauses.
- Per-keystroke delay is jittered using a CLT-approximated normal distribution.
- A drift-correction loop tracks elapsed time vs. target time and adjusts delays to keep the session on schedule.

**Typos:**
- A wrong adjacent QWERTY key is typed, then after 0–4 more characters the extension pauses, backspaces to the mistake, and retypes the correct characters.

**Permissions used:**
- `activeTab` — to interact with the current tab.
- `debugger` — to attach the Chrome Debugger Protocol and send trusted keypresses.

> While the extension is typing, Chrome will display a **"Chrome is being debugged"** banner at the top of the page. This is normal and disappears when typing finishes or is stopped.

---

## Privacy

Human Typer runs entirely locally. It never makes network requests, never contacts external servers, and requires no API keys. Your text stays in your browser.
