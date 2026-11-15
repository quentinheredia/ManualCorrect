/**
 * Small notices outside the puzzle: the dry-run toast and the copy fallback
 * shown when a site's editor refuses the corrected text. Plain DOM in their
 * own shadow root, with the same isolation as the puzzle overlay.
 */
const CSS = `
:host { all: initial !important; display: block !important; position: fixed !important; inset: 0 !important; z-index: 2147483647 !important; pointer-events: none !important; }
.root { --ink: #1c1a17; --ink-soft: #6b655a; --paper: #fbf8f1; --line: #e7dfcf; --red: #e5484d;
  font: 15px/1.45 ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: var(--ink); -webkit-font-smoothing: antialiased; }
.root * { box-sizing: border-box; }
.toast { position: fixed; left: 50%; bottom: 28px; max-width: min(92vw, 560px); transform: translateX(-50%); padding: 12px 18px; border-radius: 14px;
  background: var(--ink); color: #fff; font-size: 14px; box-shadow: 0 14px 32px -12px rgba(0,0,0,.55); pointer-events: auto; animation: in 220ms ease-out; }
.toast b { color: #ffd166; font-weight: 750; }
.toast q { quotes: '\\201C' '\\201D'; overflow-wrap: anywhere; }
.toast.out { opacity: 0; transition: opacity 250ms ease-in; }
.backdrop { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; background: rgba(22,19,14,.58); backdrop-filter: blur(4px); pointer-events: auto; animation: fade 180ms ease-out; }
.card { width: min(92vw, 520px); padding: 26px; border-radius: 20px; background: var(--paper); box-shadow: 0 24px 60px -12px rgba(20,16,8,.45); animation: in 260ms ease-out; }
h1 { margin: 0 0 4px; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
p { margin: 0 0 16px; color: var(--ink-soft); }
.text { margin: 0 0 18px; padding: 12px 14px; max-height: 10em; overflow: auto; border-radius: 12px; border: 1px solid var(--line); background: #fff; white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
.row { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
button { appearance: none; border: 0; border-radius: 12px; min-height: 44px; padding: 0 18px; font: inherit; font-weight: 750; cursor: pointer; }
.copy { background: var(--ink); color: #fff; }
.copy:hover { background: #000; }
.done { background: transparent; color: var(--ink-soft); }
.done:hover { color: var(--ink); }
button:focus-visible { outline: 3px solid #3b82f6; outline-offset: 2px; }
@keyframes in { from { opacity: 0; transform: translate(var(--tx, 0), 10px) scale(.97); } }
.toast { --tx: -50%; }
@keyframes fade { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .toast, .card, .backdrop { animation: none; } }
`;

function mount(): { host: HTMLElement; root: HTMLDivElement } {
  const host = document.createElement('manualcorrect-notice');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  const root = document.createElement('div');
  root.className = 'root';
  shadow.append(style, root);
  document.documentElement.append(host);
  return { host, root };
}

export function showToast(label: string, detail: string, durationMs = 4500): void {
  const { host, root } = mount();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  const strong = document.createElement('b');
  strong.textContent = `${label} `;
  const quote = document.createElement('q');
  quote.textContent = detail;
  toast.append(strong, quote);
  root.append(toast);
  setTimeout(() => toast.classList.add('out'), durationMs);
  setTimeout(() => host.remove(), durationMs + 300);
}

async function copy(text: string, scratch: HTMLElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API can be blocked by the page's permissions policy; fall back to a selected textarea.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    scratch.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

interface CardOptions {
  title: string;
  body: string;
  /** Shown in a selectable box, e.g. the corrected message. */
  text?: string;
  /** The quiet button; Escape does the same. */
  dismissLabel: string;
  /** The dark button. Return a label to show instead of closing, or nothing to close. */
  primary: { label: string; onClick: (button: HTMLButtonElement, scratch: HTMLElement) => Promise<string | void> };
  focus: 'dismiss' | 'primary';
}

/** A modal card in its own shadow root. Resolves true if closed by the primary button. */
function showCard(options: CardOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const { host, root } = mount();
    root.innerHTML = `
      <div class="backdrop">
        <div class="card" role="dialog" aria-modal="true" aria-labelledby="mc-card-title">
          <h1 id="mc-card-title"></h1>
          <p></p>
          <div class="text" hidden></div>
          <div class="row">
            <button type="button" class="done"></button>
            <button type="button" class="copy"></button>
          </div>
        </div>
      </div>`;
    root.querySelector('h1')!.textContent = options.title;
    root.querySelector('p')!.textContent = options.body;
    if (options.text !== undefined) {
      const box = root.querySelector<HTMLElement>('.text')!;
      box.hidden = false;
      box.textContent = options.text;
    }
    const dismiss = root.querySelector<HTMLButtonElement>('.done')!;
    const primary = root.querySelector<HTMLButtonElement>('.copy')!;
    dismiss.textContent = options.dismissLabel;
    primary.textContent = options.primary.label;
    const close = (viaPrimary: boolean) => {
      host.remove();
      resolve(viaPrimary);
    };
    primary.addEventListener('click', async () => {
      const keepOpenWith = await options.primary.onClick(primary, root);
      if (typeof keepOpenWith === 'string') primary.textContent = keepOpenWith;
      else close(true);
    });
    dismiss.addEventListener('click', () => close(false));
    root.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') close(false);
      event.stopPropagation();
    });
    (options.focus === 'primary' ? primary : dismiss).focus();
  });
}

/** The editor would not take the fixed text: hand it over with a Copy button. Resolves when dismissed. */
export async function showCopyFallback(siteName: string, text: string): Promise<void> {
  await showCard({
    title: `${siteName} fought back.`,
    body: 'Its editor refused the fixed text. You did all that spelling for nothing. Paste it yourself.',
    text,
    dismissLabel: 'Fine.',
    primary: {
      label: 'Copy',
      onClick: async (_button, scratch) =>
        (await copy(text, scratch)) ? "Copied. Ctrl+V like it's 2004." : 'Even copying failed. Select it by hand.',
    },
    focus: 'primary',
  });
}

/**
 * The dictionary could not load, so nothing can be checked. Rather than let
 * typos through silently, ask. Resolves true for "Send anyway".
 */
export function confirmUncheckedSend(): Promise<boolean> {
  return showCard({
    title: "ManualCorrect can't check this.",
    body: "Its dictionary didn't load, so your spelling is on the honour system. Reload the page to get checked again.",
    dismissLabel: "Fine, I'll wait.",
    primary: { label: 'Send anyway', onClick: async () => undefined },
    focus: 'dismiss',
  });
}
