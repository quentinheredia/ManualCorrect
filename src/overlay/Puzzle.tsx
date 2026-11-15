import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type DropAnimation,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { SpellJob } from '../core/spell';
import { SortableTile, TileFace, type TileData } from './Tile';
import { DROP_SPRING } from './spring';
import { useDragTilt } from './useDragTilt';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

type Phase = 'playing' | 'solved' | 'done' | 'leaving';

// Mirrors --card-width, --card-pad, --tile-gap and the 48px tile minimum in overlay.css.
const MIN_TILE = 48;
const TILE_GAP = 8;
const CARD_PAD = 28;

/** Horizontal sorting assumes one row; once tiles wrap, dnd-kit needs the grid strategy. */
function fitsOneRow(count: number): boolean {
  const inner = Math.min(window.innerWidth * 0.92, 620) - 2 * CARD_PAD;
  return count * MIN_TILE + (count - 1) * TILE_GAP <= inner;
}

const ADVANCE_DELAY_MS = 1150;
const LEAVE_MS = 200;

const PRAISE = ['Nice.', 'Look at you.', 'Spelling. Wow.', 'Correct. Finally.', 'Your teacher would be proud.'];

function letters(word: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return Array.from(segmenter.segment(word), (s) => s.segment);
}

/** Fisher–Yates until the order differs from the answer (impossible only if every letter is the same). */
function dealTiles(word: string, wordIndex: number): TileData[] {
  const tiles = letters(word).map((letter, i) => ({ id: `w${wordIndex}-${i}`, letter }));
  if (new Set(tiles.map((t) => t.letter)).size < 2) return tiles;
  const shuffled = [...tiles];
  do {
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  } while (shuffled.map((t) => t.letter).join('') === word);
  return shuffled;
}

interface PuzzleProps {
  job: SpellJob;
  a11yContainer: Element;
  onDone: (fixes: string[]) => void;
}

export function Puzzle({ job, a11yContainer, onDone }: PuzzleProps) {
  const { misspellings } = job;
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('playing');
  const [tiles, setTiles] = useState(() => dealTiles(misspellings[0].target, 0));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [escapeTries, setEscapeTries] = useState(0);
  const [praise, setPraise] = useState(PRAISE[0]);
  const cardRef = useRef<HTMLDivElement>(null);
  const doneButtonRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const reducedMotion = usePrefersReducedMotion();
  const tilt = useDragTilt(reducedMotion);

  const current = misspellings[index];
  const answer = useMemo(() => letters(current.target), [current.target]);
  const tokenToMisspelling = useMemo(
    () => new Map(misspellings.map((m, i) => [m.tokenIndex, i])),
    [misspellings],
  );
  const activeTile = tiles.find((t) => t.id === activeId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase === 'done') doneButtonRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const feedbackWrong = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    if (reducedMotion) {
      card.animate([{ boxShadow: 'var(--shadow-card), 0 0 0 3px var(--red)' }, { boxShadow: 'var(--shadow-card)' }], {
        duration: 450,
      });
      return;
    }
    card.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-9px) rotate(-0.4deg)' },
        { transform: 'translateX(7px) rotate(0.3deg)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(2px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 340, easing: 'ease-out' },
    );
  }, [reducedMotion]);

  const solve = useCallback(() => {
    setPhase('solved');
    setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
    later(
      () => {
        if (index + 1 < misspellings.length) {
          setIndex(index + 1);
          setTiles(dealTiles(misspellings[index + 1].target, index + 1));
          setPhase('playing');
        } else {
          setPhase('done');
        }
      },
      reducedMotion ? 600 : ADVANCE_DELAY_MS,
    );
  }, [index, later, misspellings, reducedMotion]);

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    tilt.start();
  };

  const onDragMove = ({ delta }: DragMoveEvent) => tilt.move(delta.x);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    tilt.stop();
    const from = tiles.findIndex((t) => t.id === active.id);
    const to = over ? tiles.findIndex((t) => t.id === over.id) : from;
    const next = from !== to && to !== -1 ? arrayMove(tiles, from, to) : tiles;
    setTiles(next);
    if (next.map((t) => t.letter).join('') === current.target) solve();
    else feedbackWrong();
  };

  const onDragCancel = () => {
    setActiveId(null);
    tilt.stop();
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    // Let dnd-kit's keyboard drag use Escape to cancel; otherwise Escape does nothing at all.
    if (event.key !== 'Escape' || activeId) return;
    event.preventDefault();
    event.stopPropagation();
    setEscapeTries((n) => n + 1);
  };

  const finish = () => {
    setPhase('leaving');
    later(() => onDone(misspellings.map((m) => m.target)), reducedMotion ? 0 : LEAVE_MS);
  };

  const dropAnimation: DropAnimation | null = useMemo(
    () =>
      reducedMotion
        ? null
        : {
            duration: DROP_SPRING.duration,
            easing: DROP_SPRING.easing,
            sideEffects: ({ active, dragOverlay }) => {
              // Hide the slot so the tile is not shown twice while the overlay lands in it.
              active.node.style.opacity = '0';
              dragOverlay.node.querySelector('.mc-tile')?.classList.add('is-settling');
              return () => {
                active.node.style.opacity = '';
              };
            },
          },
    [reducedMotion],
  );

  const solvedCount = phase === 'done' || phase === 'leaving' ? misspellings.length : index + (phase === 'solved' ? 1 : 0);
  const strategy = fitsOneRow(tiles.length) ? horizontalListSortingStrategy : rectSortingStrategy;
  const finished = phase === 'done' || phase === 'leaving';

  return (
    <div className={`mc-backdrop ${phase === 'leaving' ? 'is-leaving' : ''}`} onKeyDown={onKeyDown}>
      <div
        ref={cardRef}
        className={`mc-card ${phase === 'solved' ? 'is-solved' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mc-title"
        tabIndex={-1}
      >
        <header className="mc-header">
          <h1 id="mc-title" className="mc-title">
            Fix it yourself.
          </h1>
          <div className="mc-progress" aria-live="polite">
            {finished ? 'All fixed' : `Word ${index + 1} of ${misspellings.length}`}
            <span className="mc-dots" aria-hidden="true">
              {misspellings.map((m, i) => (
                <span key={m.tokenIndex} className={`mc-dot ${i < solvedCount ? 'is-done' : i === index && !finished ? 'is-current' : ''}`} />
              ))}
            </span>
          </div>
        </header>

        <p className="mc-message">
          {job.tokens.map((token, i) => {
            const m = tokenToMisspelling.get(i);
            if (m === undefined) return token.text;
            const state = m < solvedCount ? 'fixed' : m === index ? 'current' : 'pending';
            return (
              <span key={i} className={`mc-word is-${state}`}>
                {state === 'fixed' ? misspellings[m].target : token.text}
              </span>
            );
          })}
        </p>

        {finished ? (
          <div className="mc-finale">
            <p className="mc-finale__note">Every word, spelled by hand. Like a person.</p>
            <button ref={doneButtonRef} type="button" className="mc-send" onClick={finish} disabled={phase === 'leaving'}>
              Okay, NOW you can send it.
            </button>
          </div>
        ) : (
          <section className="mc-stage" key={`stage-${index}`}>
            <div className="mc-wrong">
              <s>{current.original}</s>
              {current.unfixable && <span className="mc-tag">unfixable</span>}
            </div>
            <p className="mc-instruction">
              {phase === 'solved'
                ? praise
                : current.unfixable
                  ? 'No idea what you meant. Put it back exactly how you wrote it.'
                  : 'Drag the letters into the right order.'}
            </p>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
              onDragCancel={onDragCancel}
              accessibility={{ container: a11yContainer as HTMLElement }}
            >
              <SortableContext items={tiles.map((t) => t.id)} strategy={strategy}>
                <div className="mc-tiles" style={{ '--n': tiles.length } as CSSProperties}>
                  {tiles.map((tile, i) => (
                    <SortableTile
                      key={tile.id}
                      tile={tile}
                      index={i}
                      inPlace={tile.letter === answer[i]}
                      locked={phase !== 'playing'}
                      solved={phase === 'solved'}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={dropAnimation}>
                {activeTile ? <TileFace ref={tilt.ref} letter={activeTile.letter} variant="overlay" /> : null}
              </DragOverlay>
            </DndContext>
          </section>
        )}

        <p className={`mc-escape ${escapeTries > 0 ? 'is-tried' : ''}`} key={`escape-${escapeTries}`}>
          {escapeTries > 2 ? 'There is still no escape.' : 'There is no escape.'}
        </p>
      </div>
    </div>
  );
}
