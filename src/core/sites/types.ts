import type { Editable } from '../editable';

/** A send the user attempted, as a site adapter understands it. */
export interface SendAttempt {
  /** Fields this send covers, most relevant first. The first one with typos becomes the puzzle. */
  candidates: Editable[];
  /**
   * Repeats the send once the text is fixed. In dry-run it does everything
   * except the final click/keypress, and returns what it would have done.
   */
  resend(editable: Editable, options: { dryRun: boolean }): Promise<string>;
}

export interface SiteContext {
  /** The editable the user last focused, if it is still on the page. */
  lastEditable: Editable | null;
}

/**
 * How one kind of site sends messages. Each handler returns null when the
 * event is not a send attempt, and must decide synchronously so clean messages
 * are never delayed.
 */
export interface SiteAdapter {
  name: string;
  fromKeydown(event: KeyboardEvent, ctx: SiteContext): SendAttempt | null;
  fromClick(event: MouseEvent, ctx: SiteContext): SendAttempt | null;
  fromSubmit(event: SubmitEvent, ctx: SiteContext): SendAttempt | null;
  /** Writes the corrected text and returns how, or null if the editor would not take it. */
  writeBack(editable: Editable, text: string): Promise<string | null>;
}
