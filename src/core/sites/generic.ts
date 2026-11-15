import { deepTarget, withBypass } from '../bypass';
import { insertNewline, resolveEditable, writeText, type Editable } from '../editable';
import type { SendAttempt, SiteAdapter, SiteContext } from './types';

const SEND_HINT_SELECTOR = '[aria-label*="send" i], [data-testid*="send" i]';
const CLICKABLE_SELECTOR = 'button, [role="button"], input[type="submit"], input[type="button"]';
const FIELD_SELECTOR = 'textarea, input:not([type]), input[type="text"], input[type="search"], [contenteditable]:not([contenteditable="false"])';

function findSendButton(event: Event): HTMLElement | null {
  for (const node of event.composedPath()) {
    if (!(node instanceof HTMLElement) || node === document.body) break;
    if (node.matches(SEND_HINT_SELECTOR)) return node.closest<HTMLElement>(CLICKABLE_SELECTOR) ?? node;
    if (node.matches(CLICKABLE_SELECTOR)) {
      const label = node instanceof HTMLInputElement ? node.value : node.textContent ?? '';
      return /^send$/i.test(label.trim()) ? node : null;
    }
  }
  return null;
}

function fieldsIn(form: HTMLFormElement): Editable[] {
  return Array.from(form.querySelectorAll(FIELD_SELECTOR))
    .map((el) => resolveEditable(el))
    .filter((el): el is Editable => el !== null);
}

/** Fields a button or form send covers: the one last typed in first, then the rest of its form. */
function candidatesFor(form: HTMLFormElement | null, { lastEditable }: SiteContext): Editable[] {
  if (!form) return lastEditable ? [lastEditable] : [];
  const fields = fieldsIn(form);
  return lastEditable && form.contains(lastEditable) ? [lastEditable, ...fields.filter((el) => el !== lastEditable)] : fields;
}

function dryRunOr(dryRun: boolean, description: string, send: () => void): Promise<string> {
  if (!dryRun) withBypass(send);
  return Promise.resolve(description);
}

/** Synthetic keys have no default action, so do what Enter would natively have done if the page ignored it. */
function replayEnter(editable: Editable, init: KeyboardEventInit): void {
  const down = new KeyboardEvent('keydown', init);
  const press = new KeyboardEvent('keypress', init);
  editable.dispatchEvent(down);
  editable.dispatchEvent(press);
  editable.dispatchEvent(new KeyboardEvent('keyup', init));
  if (!down.defaultPrevented && !press.defaultPrevented) {
    if (editable instanceof HTMLInputElement) editable.form?.requestSubmit();
    else insertNewline(editable);
  }
}

/** Any site: Enter in an editable, a button that looks like Send, or a form submit. */
export const genericSite: SiteAdapter = {
  name: 'This site',

  fromKeydown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey) return null;
    const editable = resolveEditable(deepTarget(event));
    if (!editable) return null;
    const init: KeyboardEventInit & { keyCode: number; which: number } = {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      bubbles: true,
      cancelable: true,
      composed: true,
    };
    return {
      candidates: [editable],
      resend: (target, { dryRun }) => dryRunOr(dryRun, 'Enter', () => replayEnter(target, init)),
    };
  },

  fromClick(event, ctx) {
    const button = findSendButton(event);
    if (!button) return null;
    const form = button instanceof HTMLButtonElement || button instanceof HTMLInputElement ? button.form : button.closest('form');
    const attempt: SendAttempt = {
      candidates: candidatesFor(form, ctx),
      resend: (_target, { dryRun }) => dryRunOr(dryRun, 'click send button', () => button.click()),
    };
    return attempt;
  },

  fromSubmit(event, ctx) {
    if (!(event.target instanceof HTMLFormElement)) return null;
    const form = event.target;
    const submitter = event.submitter;
    return {
      candidates: candidatesFor(form, ctx),
      resend: (_target, { dryRun }) =>
        dryRunOr(dryRun, 'submit form', () => form.requestSubmit(submitter?.isConnected ? submitter : undefined)),
    };
  },

  writeBack(editable, text) {
    writeText(editable, text);
    return Promise.resolve(editable instanceof HTMLElement && editable.isContentEditable ? 'insertText' : 'native value setter');
  },
};
