/**
 * humanType — drive a deterministic @cadence/engine plan into a real Playwright
 * target using genuine keyboard events (keydown/keypress/input/keyup), so the
 * editor under test sees input exactly as a person would produce it.
 *
 * This is the point of the wrapper: `locator.fill()` and `insertText` skip the
 * key-event pipeline and type instantly, hiding races and input-handler bugs
 * that only appear at human timing. Here every character is a real key press,
 * spaced by the engine's burst/jitter/typo model, and reproducible by seed.
 */
import { planTyping } from '@cadence/engine';
import type { TypingConfig, TypingEvent, TypingPlan } from '@cadence/engine';
import type { Frame, Locator, Page } from 'playwright';

export interface HumanTypeOptions extends TypingConfig {
  /** Click the target to focus and place the caret before typing. Default true. */
  focus?: boolean;

  /** Select-all + delete the target's content before typing. Default false. */
  clear?: boolean;

  /**
   * Scale every delay before executing. Use a value below 1 to speed up CI while
   * preserving the *relative* rhythm (and therefore the ordering of events that
   * exposes timing bugs). 0 runs as fast as the browser allows. Default 1.
   */
  speedFactor?: number;

  /** Clamp any single post-scale delay to at most this many ms. */
  maxDelayMs?: number;

  /** Invoked after each event is applied — handy for assertions and tracing. */
  onEvent?: (event: TypingEvent, index: number) => void;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isPageOrFrame(target: Page | Frame | Locator): target is Page | Frame {
  // Pages and Frames expose `.keyboard` / `.locator`; a Locator does not.
  return typeof (target as Page).locator === 'function' && 'keyboard' in target;
}

/** Split the engine options from the execution options for a clean handoff. */
function splitOptions(options: HumanTypeOptions): {
  config: TypingConfig;
  focus: boolean;
  clear: boolean;
  speedFactor: number;
  maxDelayMs?: number;
  onEvent?: HumanTypeOptions['onEvent'];
} {
  const { focus = true, clear = false, speedFactor = 1, maxDelayMs, onEvent, ...config } = options;
  return { config, focus, clear, speedFactor, maxDelayMs, onEvent };
}

/**
 * Type `text` into `target` with human cadence.
 *
 * Locator form:      `humanType(locator, text, options?)`
 * Page/Frame form:   `humanType(page, selector, text, options?)`
 *
 * Returns the executed {@link TypingPlan} (events, totalMs, resolved seed) so a
 * failing run can be replayed exactly by passing the same `seed` back in.
 */
export async function humanType(
  locator: Locator,
  text: string,
  options?: HumanTypeOptions,
): Promise<TypingPlan>;
export async function humanType(
  page: Page | Frame,
  selector: string,
  text: string,
  options?: HumanTypeOptions,
): Promise<TypingPlan>;
export async function humanType(
  target: Page | Frame | Locator,
  a: string,
  b?: string | HumanTypeOptions,
  c?: HumanTypeOptions,
): Promise<TypingPlan> {
  let locator: Locator;
  let text: string;
  let options: HumanTypeOptions;

  if (typeof b === 'string') {
    // Page/Frame form: (target, selector, text, options?)
    if (!isPageOrFrame(target)) {
      throw new TypeError('humanType: a selector was given but the target is not a Page or Frame');
    }
    locator = target.locator(a);
    text = b;
    options = c ?? {};
  } else {
    // Locator form: (locator, text, options?)
    if (isPageOrFrame(target)) {
      throw new TypeError('humanType: pass a selector when the target is a Page or Frame');
    }
    locator = target;
    text = a;
    options = b ?? {};
  }

  return executePlan(locator, planTyping(text, splitOptions(options).config), options);
}

/**
 * Execute an already-built {@link TypingPlan} against a Locator. Use this when
 * you want to inspect or cache the plan before driving it.
 */
export async function executePlan(
  locator: Locator,
  plan: TypingPlan,
  options: HumanTypeOptions = {},
): Promise<TypingPlan> {
  const { focus, clear, speedFactor, maxDelayMs, onEvent } = splitOptions(options);
  const page = locator.page();
  const keyboard = page.keyboard;

  if (focus) await locator.click();
  if (clear) {
    await locator.press('ControlOrMeta+A');
    await locator.press('Delete');
  }

  for (let i = 0; i < plan.events.length; i++) {
    const event = plan.events[i]!;
    let delay = event.delayMs * speedFactor;
    if (maxDelayMs != null) delay = Math.min(delay, maxDelayMs);
    if (delay > 0) await sleep(delay);

    switch (event.kind) {
      case 'key':
        // A real key press: keydown → keypress → input → keyup, modifiers and all.
        await keyboard.type(event.char!, { delay: 0 });
        break;
      case 'enter':
        await keyboard.press('Enter');
        break;
      case 'backspace':
        await keyboard.press('Backspace');
        break;
      case 'pause':
        break;
    }

    onEvent?.(event, i);
  }

  return plan;
}
