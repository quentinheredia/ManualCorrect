import { installInterceptor } from '../core/interceptor';
import { openPuzzle } from '../overlay/mount';

/**
 * The background worker re-injects this script into open tabs after an
 * install, update or reload, so never run two live copies in one page.
 *
 * The marker cannot be a plain flag: across an extension reload Chrome can keep
 * the isolated world's globals, so the orphaned copy's flag would make the
 * fresh copy skip installing and leave the tab unprotected (seen on x.com).
 * Instead the marker asks the copy that set it whether it is still connected.
 */
const MARKER = '__manualCorrectOwnerAlive';
const scope = globalThis as typeof globalThis & { [MARKER]?: () => boolean };

function ownerStillAlive(): boolean {
  try {
    return scope[MARKER]?.() === true;
  } catch {
    return false;
  }
}

if (!ownerStillAlive()) {
  scope[MARKER] = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };
  installInterceptor(openPuzzle);
}
