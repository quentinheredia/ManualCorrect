# ManualCorrect

Anti-autocorrect for Chrome. When you try to send a message with a typo,
ManualCorrect blocks the send and makes you fix every misspelled word yourself,
by dragging its scrambled letter tiles into the right order. Only then does the
corrected text go back into the box and the message send.

There is no skip button. There is no close button. There is no escape.

## Build

Needs Node 20+.

```bash
npm install
npm run build        # typecheck, then Vite + @crxjs build into dist/
```

## Load it in Chrome

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and choose the `dist/` folder.
3. After a rebuild, click the reload icon on the ManualCorrect card.

## Open the demo

Click the ManualCorrect toolbar icon (pin it from the puzzle-piece menu), then
**Open demo chat**. In the demo:

- **Load demo message** fills in
  `hey can you recieve teh package tomorow? definately need it`.
- Press **Enter** or click **Send**. You get four puzzles (recieve, teh, tomorow,
  definately), and the bubble that finally sends reads
  `hey can you receive the package tomorrow? definitely need it`.
- A message with no typos sends instantly. Shift+Enter still adds a new line.

The demo is fully offline and needs no network.

## How it works

| Piece | File |
|---|---|
| Content script entry (runs at `document_start` on every page) | `src/content/main.iife.ts` |
| Send interception (capture phase), dry-run | `src/core/interceptor.ts` |
| Per-site rules: generic (Enter, send buttons, form submit) and X | `src/core/sites/generic.ts`, `src/core/sites/x.ts` |
| Dry-run toast, "fought back" copy fallback, "can't check this" card | `src/overlay/notice.ts` |
| Re-injection into open tabs on install, update and reload | `src/background.ts` |
| Reading and writing `<textarea>`, `<input>`, `contenteditable` | `src/core/editable.ts` |
| Tokenizer that rebuilds text exactly | `src/core/tokenize.ts` |
| nspell loading and suggestion ranking | `src/core/spell.ts` |
| Shadow DOM mount | `src/overlay/mount.tsx` |
| The puzzle (dnd-kit) | `src/overlay/Puzzle.tsx`, `Tile.tsx`, `overlay.css` |
| Spring easing, drag tilt, reduced motion | `src/overlay/spring.ts`, `useDragTilt.ts`, `usePrefersReducedMotion.ts` |
| Demo chat and popup | `demo.html`, `src/demo/`, `popup.html`, `src/popup/` |

- **Spellcheck** is [nspell](https://github.com/wooorm/nspell) with the Hunspell
  en_US dictionary from `dictionary-en`, shipped as `public/dict/en_US.aff` and
  `en_US.dic` and loaded with `fetch(chrome.runtime.getURL(...))`. There are no
  network calls and no analytics.
- **Skipped words:** under 2 letters, ALL-CAPS, anything with a digit, URLs,
  bare domains, emails, @mentions, #hashtags and emoji.
- **Suggestions:** nspell's first suggestion, except that a real word one
  adjacent-letter swap away wins (nspell alone ranks "teh" as "ten"). A word with
  no suggestion is **unfixable**: you rebuild it exactly as you wrote it.
- **Chat words** Hunspell lacks (ok, lol, btw, gonna, ...) are added at load, so
  "ok" is not "corrected" to "oi".
- **Write-back:** text fields use the native `value` setter plus an `input`
  event, so React-controlled inputs update. Contenteditable editors get
  select-all + `execCommand('insertText')`. The original send is then repeated
  (synthetic Enter, `button.click()` or `form.requestSubmit()`) with a one-shot
  bypass.
- **Isolation:** the overlay renders in a shadow root whose
  `:host { all: initial !important; ... }` beats even `!important` page rules
  aimed at the host. This was tested against a page with
  `* { font-family: Comic Sans !important; color: purple !important }`, a rule
  hiding the overlay element, and a `z-index: 999999` fixed header.

### The drag

- Tiles are at least 48px, sized to the card and the word length, and wrap on
  phones. dnd-kit uses the horizontal strategy when the word fits on one row and
  the grid strategy when it wraps.
- The tile you pick up lifts, tilts and swings with your drag speed. The swing is
  written to a CSS variable every frame, so dragging never re-renders React. A
  dashed gap marks where the tile came from.
- On drop, the tile lands with a real spring (a damped spring sampled into CSS
  `linear()`), and its tilt settles with the same spring.
- A correct order locks the tiles green with a staggered snap and a pulse on the
  card. A wrong drop shakes the card. A small green bar marks letters already in
  the right place.
- Keyboard works too: Tab to a tile, Space to pick it up, arrow keys to move it,
  Space to drop.
- With `prefers-reduced-motion`, nothing moves: no tilt, swing, spring, shake or
  snap. Every state change still shows, and a wrong drop flashes a red ring
  instead of shaking.

## Tested

The tests ran in headless Chromium with `dist/` loaded unpacked. The test
scripts are throwaway Playwright scripts and are not in this repo.

- Demo page: 4 puzzles, the exact final bubble above, zero console errors or
  warnings. Also with reduced motion on, and at 390px phone width.
- Clean message: sent with no overlay and no delay.
- Escape: the overlay stays open.
- A generic page through the content script:
  - contenteditable with an `aria-label="Send message"` button
  - a `<form>` with a textarea and a "Submit order" button (submit path)
  - a text input with Enter (implicit submit)
- A public form: `https://httpbin.org/forms/post`. The typo was blocked, then
  the corrected text was posted.

## Known limitations

- **Real chat apps (WhatsApp Web, Discord, Slack) are untested.** That was the
  stretch phase, and they need a logged-in account. What will probably break:
  - Apps that ignore untrusted (synthetic) key events won't send on the replayed
    Enter. The corrected text is already in the box, so pressing Enter again
    sends it.
  - Editors that rebuild their DOM on every keystroke may react differently to
    the select-all + `insertText` write-back.
- **Enter in any textarea is intercepted when it has typos**, including
  multi-line fields where Enter means "new line". After the puzzle, the newline
  is inserted for you. This is annoying, which is in keeping with the product.
- **One field per send.** On a form with typos in several fields, only the first
  one (the last one you typed in, then document order) becomes a puzzle.
- **Send-button detection is heuristic.** It catches:
  - `[aria-label*="send" i]` and `[data-testid*="send" i]`
  - buttons whose text is exactly "Send"
  - any form submit

  Icon-only buttons with none of these markers are missed.
- **Dictionary load:** the dictionary loads the first time you focus a text
  field on a page. That is about 550 KB, parsed in about 130 ms on a dev laptop.
  If you send before it is ready, the send waits for it.
- **English only**, and names that aren't in the dictionary count as typos.
- **Frames:** the overlay covers the frame the editor lives in, not the whole tab.
- Needs a Chromium browser recent enough for CSS `linear()` easing (Chrome 113+).

## X support

On x.com (and twitter.com), ManualCorrect uses an X-specific adapter
(`src/core/sites/x.ts`) instead of the generic rules. It covers three surfaces:

- the home timeline's inline composer
- the compose modal (`/compose/post`, opened from the nav **Post** button)
- the reply composer on a post's page

Search, DMs and every other field on X are left alone.

### Selectors

These were checked against the live DOM on 2026-11-15. X's composer is a
**Draft.js** editor.

| What | Selector |
|---|---|
| Composer | `[data-testid^="tweetTextarea_"][role="textbox"][contenteditable="true"]` (see note 1) |
| Post button, inline and reply | `button[data-testid="tweetButtonInline"]` |
| Post button, modal | `button[data-testid="tweetButton"]` |
| Nav Post button (for reference only) | `a[data-testid="SideNav_NewTweet_Button"]` → `/compose/post` |

1. The composer element itself is `div[data-testid="tweetTextarea_0"]`. The
   bare `tweetTextarea_` prefix also matches `tweetTextarea_0_label` and
   `tweetTextarea_0RichTextInputContainer`, hence the extra `role` filter.
   Thread drafts add `tweetTextarea_1`, `tweetTextarea_2` and so on.

A button and its composer are paired by walking up from one to the nearest
ancestor that contains the other. With the modal open over the inline composer
(two composers on the page), each Post button reads its own composer.

### Send triggers

Both triggers are intercepted in the capture phase:

- a click on either Post button
- **Ctrl/Cmd+Enter** inside a composer

Plain Enter is never intercepted on X, because there it inserts a newline.

### Write-back

The corrected text is written back by trying methods in order. Each attempt
must leave the composer showing exactly the corrected text. For Draft, the text
inside its `[data-text="true"]` leaves must match too.

| # | Method | On X |
|---|---|---|
| 1 | select all → `execCommand('insertText')` | **Skipped** on Draft editors |
| 2 | select all → synthetic `paste` with `text/plain` | **Wins** |
| 3 | select all → `execCommand('delete')` + `insertText` | **Skipped** on Draft editors |

Why the `insertText` methods are skipped on Draft: they bypass Draft's input
handling. The browser replaces Draft's leaf spans with a bare text node, and
Draft copies that into its state.

- The composer looks right, and Draft's state even holds the right text.
- But Draft can no longer map selections, so later edits (like select all +
  delete) silently fail.
- That damage can't be undone before the next attempt, so trying them only
  breaks the composer for the next step or the manual-paste fallback.

Measured on x.com:

- `paste` and a `textInput` event both keep Draft healthy.
- `beforeinput` is ignored.

Two Draft quirks the write-back works around:

- **Select-all:** it uses `execCommand('selectAll')`, as Ctrl+A does, so the
  range sits inside the text leaves.
- **Focus:** focus returns from the puzzle first, and Draft restores its saved
  caret one render later. Selecting before that lands makes the paste append
  instead of replace, so the write-back waits for it.

If every method fails, a card says **"X fought back."** It shows the corrected
text with a **Copy** button so you can paste it yourself.

### Resend

After the write-back, ManualCorrect waits up to 2 s for the Post button to be
enabled: `aria-disabled` not `"true"` and no `disabled` attribute. It then
clicks that same button, re-finding it by `data-testid` if X re-rendered it.
Ctrl/Cmd+Enter sends are also resent with the button click, never a synthetic
key.

- Character limits are left to X: text over 280 characters is not blocked.
- @handles, #hashtags, $cashtags and URLs are not spellchecked.

### Dry-run builds

```bash
MC_DRY_RUN=1 npm run build
```

A dry-run build does everything except the final send: it solves the puzzle,
writes the text back and waits for the button to be enabled. Instead of sending,
it logs `[ManualCorrect] would post: "<text>"` and shows a toast. Use it for
all testing on X. A normal `npm run build` contains none of the dry-run code.

### Test session: `scripts/x-session.ts`

```bash
npm run build              # or MC_DRY_RUN=1 npm run build
npm run x-session
```

This opens a visible Chromium with `dist/` loaded and a persistent profile in
`.x-profile/`, which is gitignored. Log in by hand in that window. Nothing
types or stores credentials.

- The browser is started as a plain process rather than through Playwright's
  launcher. X refuses to log in from a Playwright-launched browser because it
  flags itself as automated.
- Test scripts attach to the open window over DevTools at
  `http://127.0.0.1:9333`: `chromium.connectOverCDP(...)` in Playwright.
- Set `MC_CHROMIUM` to choose another browser binary, and `MC_CDP_PORT` to
  choose another port.
- After a rebuild, reload the extension at `chrome://extensions`. Open tabs pick
  up the new build automatically, through the background re-injection. This
  Chromium disables command-line-loaded unpacked extensions on reload unless
  Developer mode is on, so turn it on once in that profile. The reload also
  fails to take effect when the extension is disabled.

Dry-run results on x.com, with every Post click and Ctrl+Enter blocked before
reaching X:

- On all three surfaces, typo click and typo Ctrl+Enter each opened 2 puzzles.
  The composer then read exactly `the package is definitely here` (Draft leaves
  included) and stayed editable, and the would-post was logged.
- Clean posts went to X with no overlay.
- Enter in the search box went through untouched.
- No errors from the extension.

### Extension reloads and updates (incident, 2026-11-15)

During X development, a post with its typos uncorrected went out from the test
account. It was deleted right after.

**What happened.** The X tab had been open since before several extension
reloads made during development.

- Chrome does not inject content scripts into tabs that are already open.
- The copy already in such a tab is orphaned: it can no longer reach the
  extension, so it can't load the dictionary.
- That tab had no working copy, so X received the Post click untouched.
- The same thing happens to real users after every extension update.

**The fixes:**

- **Re-injection.** A background service worker (`src/background.ts`) injects
  the content script into open http(s) tabs on install, update and reload. This
  is why the manifest now asks for `scripting` and `<all_urls>` host access.
- **Orphans step aside.** An orphaned copy removes its own listeners on its
  next event.
- **No silent fallback.** If the dictionary fails to load, the send is held and
  a card says so, with **Send anyway**. Previously the send went through
  silently.
- **No duplicate copies.** `src/content/main.iife.ts` avoids running two live
  copies. Its marker asks the copy that set it whether that copy is still
  connected. A plain flag survived reloads in this browser and blocked the
  fresh copy.

**Tests.** The extension was reloaded under an open page, then a typo was sent
from that page:

- Locally, the orphan stepped aside, the new copy opened the puzzle and nothing
  was sent.
- On x.com, the same steps ran 3 times with every Post click caught by a guard.
  Each time the puzzle opened and 0 clicks reached X.

### Known breakages and risks

- **Tabs open from before this fix need one refresh.** Their orphaned copy runs
  the old code, which doesn't know how to step aside.
- **Selectors are X's to change.** The adapter relies on the `data-testid`
  values above. If X renames them, ManualCorrect falls silent on X rather than
  blocking anything.
- **The resend is a synthetic, untrusted `.click()`.** A guarded test confirmed
  where it lands, using a normal build with every Post click caught before
  reaching X. After solving, for both Post-click and Ctrl+Enter sends, it hits
  `tweetButtonInline` exactly once, on the first try, unblocked.
  Whether X's handler then accepts an untrusted click can only be shown by a
  real post.
- **Thread drafts:** only the first composer with typos becomes the puzzle.
- **Typing while the puzzle is open is blocked**, and so is a second post
  attempt until the puzzle is solved.

## License notes

The dictionary comes from `dictionary-en` (SCOWL / Hunspell en_US). Its
license is in `public/dict/LICENSE`.
