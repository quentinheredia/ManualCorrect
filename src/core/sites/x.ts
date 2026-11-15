import { deepTarget, withBypass } from '../bypass';
import { readText, resolveEditable, type Editable } from '../editable';
import type { SiteAdapter } from './types';

/**
 * x.com post composers: home inline, the /compose/post modal, and replies.
 * Verified against the live DOM (Draft.js editor):
 *   composer: div[data-testid="tweetTextarea_0"][role="textbox"][contenteditable="true"]
 *             (the bare prefix also matches tweetTextarea_0_label and
 *             tweetTextarea_0RichTextInputContainer, hence the role filter)
 *   post:     button[data-testid="tweetButtonInline"] (inline, reply)
 *             button[data-testid="tweetButton"] (modal)
 * Everything else on X (search, DMs, other inputs) is deliberately ignored.
 */
const COMPOSER = '[data-testid^="tweetTextarea_"][role="textbox"][contenteditable="true"]';
const POST_BUTTON_IDS = ['tweetButtonInline', 'tweetButton'];
const POST_BUTTON = POST_BUTTON_IDS.map((id) => `[data-testid="${id}"]`).join(', ');
const ENABLE_TIMEOUT_MS = 2000;
const SETTLE_TIMEOUT_MS = 500;
const LOG = '[ManualCorrect]';

export function isX(hostname: string): boolean {
  return /(^|\.)(x|twitter)\.com$/.test(hostname);
}

function composerFrom(node: EventTarget | null): HTMLElement | null {
  const editable = resolveEditable(node);
  return editable instanceof HTMLElement && editable.matches(COMPOSER) ? editable : null;
}

/**
 * The matches inside the smallest ancestor of `from` that has any. With an
 * inline composer and the modal both open, this keeps each button paired with
 * its own composer instead of the first one in the document.
 */
function nearest<T extends Element>(from: Element, selector: string): T[] {
  for (let el = from.parentElement; el; el = el.parentElement) {
    const found = el.querySelectorAll<T>(selector);
    if (found.length > 0) return Array.from(found);
  }
  return [];
}

function isEnabled(button: HTMLElement): boolean {
  return button.getAttribute('aria-disabled') !== 'true' && !(button as HTMLButtonElement).disabled;
}

function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Waits for X to enable the post button after the write-back (React has to
 * see the new editor state first), re-finding it if X re-rendered it.
 */
async function enabledButton(original: HTMLElement, composer: HTMLElement): Promise<HTMLElement | null> {
  const testId = original.dataset.testid ?? POST_BUTTON_IDS[0];
  const find = () =>
    original.isConnected
      ? original
      : nearest<HTMLElement>(composer, `[data-testid="${testId}"]`)[0] ?? document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const deadline = performance.now() + ENABLE_TIMEOUT_MS;
  let button = find();
  while (performance.now() < deadline) {
    if (button && isEnabled(button)) return button;
    await new Promise((resolve) => setTimeout(resolve, 50));
    button = find();
  }
  return button && isEnabled(button) ? button : null;
}

function attemptFor(button: HTMLElement, composer: HTMLElement) {
  // A thread draft has several composers under one button; the one in use goes first.
  const others = nearest<HTMLElement>(button, COMPOSER).filter((el) => el !== composer);
  return {
    candidates: [composer, ...others] as Editable[],
    async resend(editable: Editable, { dryRun }: { dryRun: boolean }) {
      const target = await enabledButton(button, editable as HTMLElement);
      if (!target) return `post button never enabled within ${ENABLE_TIMEOUT_MS}ms`;
      const label = `click [data-testid="${target.dataset.testid}"]`;
      if (!dryRun) withBypass(() => target.click());
      return label;
    },
  };
}

// ---------- Write-back ladder ----------

const normalize = (text: string) => text.replace(/ /g, ' ');

/**
 * Draft renders text only inside `[data-text="true"]` leaves. A write can show
 * the right text while having replaced those leaves with a bare text node:
 * Draft's state is right but it can no longer map selections, so later edits
 * (select all + delete) silently fail. Null when the editor is not Draft.
 */
function draftLeafText(el: HTMLElement): string | null {
  const contents = el.querySelector('[data-contents="true"]');
  if (!contents) return null;
  return Array.from(contents.querySelectorAll('[data-block="true"]'), (block) =>
    Array.from(block.querySelectorAll('[data-text="true"]'), (leaf) => leaf.textContent ?? '').join(''),
  ).join('\n');
}

function showsExactly(el: HTMLElement, text: string): boolean {
  if (normalize(readText(el)) !== text) return false;
  const leaves = draftLeafText(el);
  return leaves === null || normalize(leaves) === text;
}

/** Polls the editor until it shows `text` exactly, in its own structure, or gives up. */
async function settlesTo(el: HTMLElement, text: string): Promise<boolean> {
  const deadline = performance.now() + SETTLE_TIMEOUT_MS;
  do {
    await frame();
    if (showsExactly(el, text)) return true;
  } while (performance.now() < deadline);
  return false;
}

/**
 * Selects everything the way Ctrl+A does. The browser's own select-all puts
 * the range inside the editor's text leaves; a range on the editor root
 * instead makes the native insert delete Draft's leaf spans. Draft keeps its
 * own copy of the selection, synced from selection events, so it gets a
 * frame to catch up before the edit.
 *
 * Focus comes back from the puzzle overlay first, and on focus Draft restores
 * its saved caret one render later, which would overwrite our select-all
 * (the paste then appends instead of replacing). So: focus, let that land, select.
 */
async function selectAll(el: HTMLElement): Promise<void> {
  if (el.ownerDocument.activeElement !== el) {
    el.focus();
    await frame();
    await frame();
  }
  if (!el.ownerDocument.execCommand('selectAll')) {
    const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    let last = first;
    for (let node = first; node; node = walker.nextNode()) last = node;
    const range = el.ownerDocument.createRange();
    if (first && last) {
      range.setStart(first, 0);
      range.setEnd(last, last.textContent?.length ?? 0);
    } else {
      range.selectNodeContents(el);
    }
    const selection = el.ownerDocument.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  await frame();
}

const WRITE_METHODS: Array<[string, (el: HTMLElement, text: string) => void]> = [
  ['insertText', (el, text) => el.ownerDocument.execCommand('insertText', false, text)],
  [
    'paste',
    (el, text) => {
      const data = new DataTransfer();
      data.setData('text/plain', text);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true, composed: true }));
    },
  ],
  [
    'delete+insertText',
    (el, text) => {
      el.ownerDocument.execCommand('delete');
      el.ownerDocument.execCommand('insertText', false, text);
    },
  ],
];

/**
 * Tried in order; the first one that leaves the editor showing exactly `text`
 * (in its own structure) wins.
 *
 * On Draft.js (X's editor today) both execCommand methods are skipped: they
 * bypass Draft's input handling, Draft copies the mangled DOM into its state
 * on the `input` event, and the composer looks right but stops accepting
 * edits. That damage cannot be undone before the next attempt (or before the
 * user pastes by hand), so they are not worth trying. Tested on x.com: paste
 * and textInput keep Draft healthy; insertText does not.
 */
async function writeBack(editable: Editable, text: string): Promise<string | null> {
  const el = editable as HTMLElement;
  const isDraft = draftLeafText(el) !== null;
  for (const [name, write] of WRITE_METHODS) {
    if (isDraft && name.includes('insertText')) {
      console.debug(LOG, `write-back ${name} skipped: it desyncs Draft.js editors`);
      continue;
    }
    await selectAll(el);
    write(el, text);
    if (await settlesTo(el, text)) {
      console.debug(LOG, `write-back succeeded with ${name}`);
      return name;
    }
    console.debug(LOG, `write-back ${name} left`, JSON.stringify(readText(el)));
  }
  return null;
}

export const xSite: SiteAdapter = {
  name: 'X',

  fromKeydown(event) {
    // Plain Enter is a newline on X; only Ctrl/Cmd+Enter posts.
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return null;
    const composer = composerFrom(deepTarget(event));
    if (!composer) return null;
    const button = nearest<HTMLElement>(composer, POST_BUTTON)[0];
    return button ? attemptFor(button, composer) : null;
  },

  fromClick(event) {
    const button = event
      .composedPath()
      .find((node): node is HTMLElement => node instanceof HTMLElement && node.matches(POST_BUTTON));
    if (!button) return null;
    const composers = nearest<HTMLElement>(button, COMPOSER);
    const focused = composers.find((el) => el.contains(document.activeElement)) ?? composers[0];
    return focused ? attemptFor(button, focused) : null;
  },

  fromSubmit() {
    return null;
  },

  writeBack,
};
