# Build & Scale Plan — Repositioning the Typing Engine as a Dev Tool

**Working name:** `Cadence` (placeholder — pick your own)
**One-liner:** *Realistic human-typing simulation for testing rich-text editors and recording flawless product demos.*

---

## 0. Why this pivot

The valuable asset in this repo is **not** the LMS integration — it's the typing engine:
Poisson-distributed bursts, CLT-jittered inter-keystroke delays, drift-corrected pacing,
fatigue modeling, self-correcting QWERTY typos, and — critically — the ability to inject
**browser-trusted** input via the Chrome Debugger Protocol, which synthetic JS events can't do.

That capability has a clean, honest, *paying* market: engineering and devrel teams who need
human-like text input they can't fake with `element.value = "..."` or a naive `sendKeys`.

We keep the engine, drop the "defeat detection" framing, and change who we sell to. The buyer
flips from "student trying to beat their school" (unsellable, churny, platform-banned, legally
exposed) to "engineer with a company card" (recurring, defensible, referenceable).

**Two buyers, one engine:**
1. **QA / test automation** — teams building collaborative editors (Notion/Coda/TipTap/ProseMirror/Lexical/Quill/Slate shops) need to fuzz and load-test input handling with realistic human sequences, IME edge cases, and rapid edits. *This is the wedge.*
2. **Product-demo / screencast automation** — devrel, marketing, and course creators who want on-screen typing that looks human instead of robotic paste-dumps.

---

## 1. Product shape

Ship **three surfaces** off one core engine. Build in this order.

### Phase 1 — Open-source core library (the top of the funnel)
- Extract the engine from `extension/content/typing-simulator.js` into a framework-agnostic
  TypeScript package: `@cadence/engine`.
- Pure functions: given text + a config (WPM, variability, typo rate, fatigue, bursts), it
  emits a **timed event stream** (`{ char, delayMs, type: 'key'|'backspace'|'pause' }[]`).
  No DOM, no Chrome APIs — just the human-rhythm model. This is the crown jewel and it's
  100% reusable.
- MIT license, great README, live playground page. **This is your marketing.** Developers
  trust tools they can read. It drives every other surface.

### Phase 2 — Playwright / Cypress plugin (the paid wedge)
- `@cadence/playwright` and `@cadence/cypress`: `await humanType(page, selector, text, opts)`.
- Under the hood it uses each framework's real input dispatch (Playwright's CDP session is
  already trusted — you don't even need your own debugger attach here) driven by the engine's
  event stream.
- Sell the **Pro tier**: recorded "typing personas" (fast dev, hunt-and-peck, mobile thumb-typer),
  IME/composition-event simulation, deterministic seeds for reproducible CI runs, and a
  reporter that flags editor race conditions surfaced by realistic timing.
- **This is what companies pay for** — it slots into existing CI with near-zero switching cost.

### Phase 3 — Demo Studio (the second revenue line)
- A repackaged, *legitimately-scoped* browser extension + desktop recorder: type any script
  into any field on screen with human cadence, for **recording demos and tutorials**.
- Explicitly scoped away from LMS/exam contexts (see §6). Ships with a visible "simulated
  typing" indicator by default. Sells to course creators and devrel on a simple monthly plan.

---

## 2. Positioning & messaging

| | Old framing | New framing |
|---|---|---|
| Headline | "Invisible typing. Human results." | "Human-realistic typing for tests and demos." |
| Hero feature | "Beat keystroke-timing analysis" | "Catch the editor bugs that only appear at human speed." |
| Buyer | Student | Engineer / devrel |
| Proof | Screenshot of Google Docs | A failing test that passes with naive input but *fails* with realistic timing — because the editor had a real race condition. That demo sells the whole product. |

Kill every "stealth," "undetectable," and "evade" string in the codebase and copy. They're
liabilities now, not features. The same math (fatigue, bursts, error zones) is a *fidelity*
story, not an *evasion* story — market it that way.

---

## 3. Monetization

Land-and-expand on the dev-tool side; simple subscription on the Demo Studio side.

**Cadence for Testing (the money):**
- **Free / OSS** — the engine + basic Playwright helper. Unlimited. Drives adoption.
- **Team — ~$20/dev/mo (annual)** — personas, IME simulation, deterministic seeds, CI reporter,
  private Slack/Discord support.
- **Enterprise — custom** — SSO, on-prem/self-host, priority support, design-partner input on
  roadmap. This is where real revenue is; one 30-seat contract beats thousands of $2.99 students.

**Cadence Demo Studio:**
- **$12/mo or $99/yr**, single flat tier. Course creators and solo devrel. Keep it dead simple.

Use **Stripe**, not Gumroad — you'll want proper subscription management, seats, and invoicing
for the B2B motion. Gumroad is fine only for the Demo Studio consumer tier.

**Rough model to sanity-check yourself against:** 30 paying teams averaging 8 seats at $20/mo =
~$57.6k ARR. That's a realistic 12-month target for a solid OSS-led dev tool with real
distribution effort. It does not require going viral — it requires being genuinely useful to a
narrow group and being findable.

---

## 4. Go-to-market

OSS-led growth. The library *is* the top of funnel; content and community convert it.

1. **Launch the OSS engine first** with a killer playground and a blog post:
   *"Why `element.value = text` hides bugs in your rich-text editor"* — a technical piece with a
   live reproduction. Post to Hacker News, r/javascript, r/QualityAssurance, Lobsters.
2. **Meet buyers where they already hurt:** answer real questions on the Playwright/Cypress
   Discords, StackOverflow, and GitHub issues of editor libraries (TipTap, Lexical, ProseMirror)
   about flaky input tests. Be useful first; the tool sells itself.
3. **Design partners over ads:** DM 20 teams shipping collaborative editors. Offer free
   Team access + hands-on help in exchange for feedback and a logo/testimonial. Five good ones
   give you your case studies and your roadmap.
4. **Docs and DevRel content** are the growth engine long-term: recipes ("test undo/redo under
   realistic timing"), persona guides, CI templates. SEO around "test rich text editor,"
   "playwright human typing," "cypress realistic input."
5. **Marketplace listings** for the Demo Studio side: Chrome Web Store (properly scoped) and a
   Product Hunt launch once you have a demo GIF that pops.

---

## 5. Execution roadmap

**Weeks 1–2 — Extract & prove**  ← _started; see `packages/engine/`_
- [x] Pull the pure engine out of `typing-simulator.js` into `@cadence/engine` (TS, no DOM,
      seedable RNG so CI runs are reproducible).
- [x] Unit tests on the statistical model (burst distribution, fatigue curve, error zones,
      seed determinism, and the reconstruction invariant — applying the stream reproduces the
      input text exactly). 23 tests, run natively via `node --test`.
- [x] Build the live playground (`packages/engine/playground/`) — text in → animated preview
      + plan-JSON view, driven by the compiled engine.
- [ ] Publish `@cadence/engine` to npm and wire the playground to a public URL.

**Weeks 3–5 — The wedge**  ← _started; see `packages/playwright/`_
- [x] `@cadence/playwright` wrapper — `humanType(locator, text, opts)` drives the engine's
      plan into a real page via genuine trusted key events; personas, deterministic seeds,
      `speedFactor` for fast CI, `clear`/`focus`, and pre-built-plan execution. 8 real-browser
      E2E tests (textarea + contenteditable, keydown-fires proof, determinism).
- [ ] The "race condition caught by realistic timing" demo repo — a test that passes with
      `fill()` but fails with `humanType`, because the editor had a real timing bug.
- [ ] Cypress plugin (`@cadence/cypress`).
- [ ] Docs site (Docusaurus/Nextra). Getting-started in <5 min.
- [ ] Write and ship the launch blog post.

**Weeks 6–8 — Launch & sell**
- [ ] HN / Reddit / Lobsters launch of the OSS engine + post.
- [ ] Stand up Stripe + a gated Team tier (personas, seeds, reporter).
- [ ] Cold-DM 20 editor teams; onboard 3–5 design partners.

**Weeks 9–12 — Second surface & tighten**
- [ ] Ship Demo Studio (scoped extension) + Product Hunt launch.
- [ ] First case study published; start weekly content cadence.

---

## 6. Guardrails (this is what keeps the business alive)

The whole point of the pivot is that the product is honest. Protect that deliberately:

- **Scope the Demo Studio extension away from exam/LMS contexts.** Don't ship `host_permissions`
  for `instructure.com`, `blackboard.com`, `moodle.*`, or exam/proctoring domains. Removing the
  academic-integrity surface is a *feature* to your real buyers and to the Chrome Web Store review.
- **Default to a visible "simulated typing" indicator** in Demo Studio. Transparency is on-brand
  for a demo tool and defuses misuse.
- **Position the CI product around your own/consenting test targets** — you're testing software
  you're authorized to test. That's the entire framing.
- **Drop all evasion language** from code, comments, store listing, and site. If a string's value
  proposition is "someone won't be able to tell," cut it.
- Keep an eye on Chrome Web Store MV3 policy and CDP `debugger`-permission rules — for the CI
  product you mostly avoid this by riding Playwright/Cypress's own driver instead of your own
  debugger attach.

---

## 7. First concrete step — done

`@cadence/engine` now exists as a standalone pure-TS package (`packages/engine/`): the
burst/jitter/fatigue/typo model ported out of `typing-simulator.js`, stripped of all Chrome
Debugger, DOM, storage, and paywall code, and made **deterministic** via a seedable RNG. It ships
with 23 passing tests and a live playground. This is the reusable core of everything above and the
first OSS marketing asset.

**Done next**: `@cadence/playwright` (`packages/playwright/`) — the paid wedge — now drives the
engine into a real editor via genuine key events, with personas, deterministic seeds, and
fast-CI scaling, verified by real-browser E2E tests.

**Next**: a "race condition caught by realistic timing" demo repo (the artifact that sells the
tool), then the Cypress plugin and the docs site / launch post.
