import { useEffect, useRef } from 'react';
import { clearFit, fitMultiline, type FitTier } from '../lib/fitText';
import { useAnimating } from '../contexts/Animating';

type Options = {
  tier: FitTier;
  enabled: boolean;
  // Re-run when this changes (typically the cell content string).
  deps?: unknown[];
};

// Hook target: the container element holding one <span> per line.
// fitMultiline iterates each child line and fits it to the container width
// with maxLineH = containerHeight / lineCount.
export function useFitText<T extends HTMLElement>(opts: Options) {
  const { tier, enabled, deps = [] } = opts;
  const ref = useRef<T>(null);
  const animating = useAnimating();
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!enabled) {
      clearFit(el);
      return;
    }

    const run = () => {
      rafRef.current = null;
      if (animating.isAnimating()) return;
      fitMultiline(el, tier);
    };

    const schedule = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(run);
    };

    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
      document.fonts.ready.then(schedule).catch(schedule);
    } else {
      schedule();
    }

    const ro = new ResizeObserver(schedule);
    ro.observe(el);

    const unsub = animating.onChange((isAnim) => {
      if (!isAnim) schedule();
    });

    return () => {
      ro.disconnect();
      unsub();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, enabled, animating, ...deps]);

  return ref;
}
