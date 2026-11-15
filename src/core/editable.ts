export type TextField = HTMLTextAreaElement | HTMLInputElement;
export type Editable = TextField | HTMLElement;

const TEXT_INPUT_TYPES = new Set(['text', 'search', '']);

export function isTextField(el: Element): el is TextField {
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(el.getAttribute('type')?.toLowerCase() ?? '');
}

/** Finds the editable an event came from, climbing to the contenteditable root. */
export function resolveEditable(node: EventTarget | null | undefined): Editable | null {
  if (!(node instanceof Element)) return null;
  if (isTextField(node)) return node.readOnly || node.disabled ? null : node;
  if (!(node instanceof HTMLElement) || !node.isContentEditable) return null;
  let root: HTMLElement = node;
  while (root.parentElement?.isContentEditable) root = root.parentElement;
  return root;
}

export function readText(el: Editable): string {
  if (isTextField(el)) return el.value;
  // Rich editors usually leave one trailing newline for the empty caret line.
  return el.innerText.replace(/\n$/, '');
}

/**
 * Writes text the way a user would, so framework-controlled inputs notice.
 * React tracks `value` through its own setter, so the prototype setter is
 * called directly and followed by an input event. Rich editors (Lexical,
 * Slate, ProseMirror) own their DOM, so they get a real editing command.
 */
export function writeText(el: Editable, text: string): void {
  if (isTextField(el)) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    el.setSelectionRange(text.length, text.length);
    return;
  }
  el.focus();
  const selection = el.ownerDocument.getSelection();
  const range = el.ownerDocument.createRange();
  range.selectNodeContents(el);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const inserted = el.ownerDocument.execCommand('insertText', false, text);
  if (!inserted) {
    el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }
}

export function insertNewline(el: Editable): void {
  el.focus();
  el.ownerDocument.execCommand(isTextField(el) ? 'insertText' : 'insertLineBreak', false, '\n');
}
