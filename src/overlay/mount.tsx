import { createRoot } from 'react-dom/client';
import type { SpellJob } from '../core/spell';
import { Puzzle } from './Puzzle';
import { DROP_SPRING } from './spring';
import css from './overlay.css?inline';

const HOST_TAG = 'manualcorrect-overlay';

/**
 * Renders the puzzle in a shadow root so page CSS cannot style it and its CSS
 * cannot touch the page. `:host { all: initial }` in overlay.css also stops
 * inherited properties (font, color, line-height) crossing the boundary.
 * Resolves with the corrected word for each misspelling, in order.
 */
export function openPuzzle(job: SpellJob): Promise<string[]> {
  return new Promise((resolve) => {
    const host = document.createElement(HOST_TAG);
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = css;
    const mountPoint = document.createElement('div');
    mountPoint.className = 'mc-root';
    mountPoint.style.setProperty('--spring', DROP_SPRING.easing);
    mountPoint.style.setProperty('--spring-ms', `${DROP_SPRING.duration}ms`);
    // dnd-kit's screen-reader live region would otherwise be appended to the page's <body>.
    const a11y = document.createElement('div');
    shadow.append(style, mountPoint, a11y);
    document.documentElement.append(host);

    const root = createRoot(mountPoint);
    const onDone = (fixes: string[]) => {
      root.unmount();
      host.remove();
      resolve(fixes);
    };
    root.render(<Puzzle job={job} a11yContainer={a11y} onDone={onDone} />);
  });
}
