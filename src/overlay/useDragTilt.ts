import { useCallback, useRef } from 'react';

const DEG_PER_PX_PER_MS = 9;
const MAX_TILT_DEG = 14;
/** Per-frame decay of the swing target, so the tile rights itself when you stop moving. */
const TARGET_DECAY = 0.86;
/** Per-frame easing toward the target: a cheap critically-damped follow. */
const FOLLOW = 0.22;

/**
 * Swings the dragged tile in the direction of travel, like a card held at the
 * top. Written straight to a CSS variable on the overlay node each frame, so
 * dragging never re-renders React.
 */
export function useDragTilt(disabled: boolean) {
  const node = useRef<HTMLDivElement | null>(null);
  const state = useRef({ current: 0, target: 0, lastX: 0, lastT: 0, frame: 0 });

  const loop = useCallback(() => {
    const s = state.current;
    s.target *= TARGET_DECAY;
    s.current += (s.target - s.current) * FOLLOW;
    node.current?.style.setProperty('--tilt', `${s.current.toFixed(2)}deg`);
    s.frame = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(() => {
    const s = state.current;
    Object.assign(s, { current: 0, target: 0, lastX: 0, lastT: performance.now() });
    if (!disabled) s.frame = requestAnimationFrame(loop);
  }, [disabled, loop]);

  const move = useCallback((x: number) => {
    const s = state.current;
    const now = performance.now();
    const velocity = (x - s.lastX) / Math.max(now - s.lastT, 1);
    s.target = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, velocity * DEG_PER_PX_PER_MS));
    s.lastX = x;
    s.lastT = now;
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(state.current.frame);
    node.current?.style.setProperty('--tilt', '0deg');
  }, []);

  return { ref: node, start, move, stop };
}
