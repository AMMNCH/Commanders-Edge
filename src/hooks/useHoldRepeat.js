import { useRef, useCallback, useEffect } from 'react';

/**
 * Press-and-hold auto-repeat with acceleration. `onStep(n)` is called once on
 * press and then repeatedly while held; `onRelease()` fires when the finger
 * lifts. Returns pointer handlers to spread onto an element.
 */
export default function useHoldRepeat(onStep, onRelease, { delay = 420, min = 55, start = 230, accel = 14 } = {}) {
  const timer = useRef(null);
  const ticks = useRef(0);
  const active = useRef(false);
  const stepRef = useRef(onStep);
  const releaseRef = useRef(onRelease);
  stepRef.current = onStep;
  releaseRef.current = onRelease;

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = null;
    if (active.current) {
      active.current = false;
      releaseRef.current?.();
    }
  }, []);

  const begin = useCallback((e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    clearTimeout(timer.current);
    active.current = true;
    ticks.current = 0;
    stepRef.current(1);
    const tick = () => {
      ticks.current += 1;
      stepRef.current(ticks.current);
      timer.current = setTimeout(tick, Math.max(min, start - ticks.current * accel));
    };
    timer.current = setTimeout(tick, delay);
  }, [delay, min, start, accel]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    onPointerDown: begin,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e) => e.preventDefault(),
  };
}
