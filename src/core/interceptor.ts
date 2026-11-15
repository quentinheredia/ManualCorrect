import { deepTarget, isBypassing } from './bypass';
import { readText, resolveEditable, type Editable } from './editable';
import { analyze, loadSpeller, readySpeller, type SpellJob } from './spell';
import { genericSite } from './sites/generic';
import type { SendAttempt, SiteAdapter } from './sites/types';
import { isX, xSite } from './sites/x';
import { rebuild } from './tokenize';
import { confirmUncheckedSend, showCopyFallback, showToast } from '../overlay/notice';

type Speller = NonNullable<ReturnType<typeof readySpeller>>;

export type PuzzleOpener = (job: SpellJob) => Promise<string[]>;

const LOG = '[ManualCorrect]';
/** Build with MC_DRY_RUN=1: solve and write back, but never press the final send. */
const DRY_RUN = __MC_DRY_RUN__;

let site: SiteAdapter = genericSite;
let lastEditable: Editable | null = null;
let puzzleOpen = false;
let swallowNextEnterKeyup = false;
let openPuzzle: PuzzleOpener;

function block(event: Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

/** The first candidate with typos, as a puzzle. One field is puzzled per send. */
function firstPuzzle(sp: Speller, candidates: Editable[]): { job: SpellJob; editable: Editable } | null {
  for (const editable of candidates) {
    const text = readText(editable);
    if (!text.trim()) continue;
    const job = analyze(sp, text);
    if (job.misspellings.length > 0) return { job, editable };
  }
  return null;
}

function nextFrame(): Promise<void> {
  // One frame plus a beat lets framework state (React, Lexical, Draft) catch up with the write-back.
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 30)));
}

async function resend(attempt: SendAttempt, editable: Editable): Promise<void> {
  const action = await attempt.resend(editable, { dryRun: DRY_RUN });
  if (!DRY_RUN) return;
  const text = readText(editable);
  console.log(`${LOG} would post: "${text}"`, `(${action})`);
  showToast('Dry run. Would post:', text);
}

async function solveThenResend(job: SpellJob, editable: Editable, attempt: SendAttempt): Promise<void> {
  console.debug(LOG, `[${site.name}] blocked send, misspellings:`, job.misspellings.map((m) => `${m.original} → ${m.target}`));
  puzzleOpen = true;
  try {
    const fixes = await openPuzzle(job);
    const corrected = rebuild(job.tokens, new Map(job.misspellings.map((m, i) => [m.tokenIndex, fixes[i]])));
    const method = await site.writeBack(editable, corrected);
    if (method === null) {
      console.warn(LOG, `[${site.name}] every write-back method failed`);
      await showCopyFallback(site.name, corrected);
      return;
    }
    await nextFrame();
    await resend(attempt, editable);
  } finally {
    puzzleOpen = false;
  }
}

/** Decides synchronously whenever the dictionary is ready, so clean messages are never delayed. */
function onSendAttempt(event: Event, attempt: SendAttempt | null): void {
  if (!attempt) return;
  if (puzzleOpen) {
    block(event);
    return;
  }
  const filled = attempt.candidates.filter((el) => readText(el).trim());
  if (filled.length === 0) return;

  const speller = readySpeller();
  if (speller) {
    const found = firstPuzzle(speller, filled);
    if (!found) return;
    block(event);
    void solveThenResend(found.job, found.editable, attempt);
    return;
  }

  // Dictionary still loading: hold the send until we know.
  block(event);
  puzzleOpen = true;
  loadSpeller()
    .then((sp) => {
      puzzleOpen = false;
      const found = firstPuzzle(sp, filled);
      if (found) void solveThenResend(found.job, found.editable, attempt);
      else void resend(attempt, filled[0]);
    })
    .catch(async (error) => {
      // Never let a send through unchecked without saying so: that is how a
      // typo reaches the world while the user believes it was checked.
      console.warn(LOG, 'dictionary failed to load, asking before sending unchecked:', error);
      const sendAnyway = await confirmUncheckedSend();
      puzzleOpen = false;
      if (sendAnyway) void resend(attempt, filled[0]);
    });
}

const extensionHosted = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

/**
 * After the extension is reloaded or updated, the copy of this script already
 * running in an open tab is orphaned: its listeners still fire, but it can no
 * longer reach the extension (no dictionary), so it can only get sends wrong.
 * The new copy is injected by the background worker; the orphan steps aside.
 */
function orphaned(): boolean {
  if (!extensionHosted) return false;
  try {
    return !chrome.runtime?.id;
  } catch {
    return true;
  }
}

function context() {
  return { lastEditable: lastEditable?.isConnected ? lastEditable : null };
}

function onFocusIn(event: FocusEvent): void {
  if (stepAsideIfOrphaned()) return;
  const editable = resolveEditable(deepTarget(event));
  if (!editable) return;
  lastEditable = editable;
  void loadSpeller().catch((error) => console.warn(LOG, error));
}

function onKeyDown(event: KeyboardEvent): void {
  if (stepAsideIfOrphaned() || isBypassing() || event.isComposing || event.keyCode === 229) return;
  onSendAttempt(event, site.fromKeydown(event, context()));
  if (event.defaultPrevented && event.key === 'Enter') swallowNextEnterKeyup = true;
}

function onKeyUp(event: KeyboardEvent): void {
  if (stepAsideIfOrphaned() || isBypassing() || event.key !== 'Enter' || !swallowNextEnterKeyup) return;
  swallowNextEnterKeyup = false;
  block(event);
}

function onClick(event: MouseEvent): void {
  if (stepAsideIfOrphaned() || isBypassing()) return;
  onSendAttempt(event, site.fromClick(event, context()));
}

function onSubmit(event: SubmitEvent): void {
  if (stepAsideIfOrphaned() || isBypassing()) return;
  onSendAttempt(event, site.fromSubmit(event, context()));
}

const CAPTURE = { capture: true };
const LISTENERS = [
  ['focusin', onFocusIn],
  ['keydown', onKeyDown],
  ['keyup', onKeyUp],
  ['click', onClick],
  ['submit', onSubmit],
] as const;

function stepAsideIfOrphaned(): boolean {
  if (!orphaned()) return false;
  for (const [type, listener] of LISTENERS) window.removeEventListener(type, listener as EventListener, CAPTURE);
  console.info(LOG, 'extension was reloaded; this old copy stepped aside for the new one');
  return true;
}

let installed = false;

export function installInterceptor(opener: PuzzleOpener): void {
  if (installed) return;
  installed = true;
  openPuzzle = opener;
  site = isX(location.hostname) ? xSite : genericSite;
  if (DRY_RUN) console.info(LOG, `dry-run build: sends are solved and written back, never posted (site: ${site.name})`);
  for (const [type, listener] of LISTENERS) window.addEventListener(type, listener as EventListener, CAPTURE);
  const active = resolveEditable(document.activeElement);
  if (active) lastEditable = active;
}
