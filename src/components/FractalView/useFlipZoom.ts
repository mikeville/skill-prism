import { useLayoutEffect, useRef } from 'react';

export type ZoomOrigin = {
  x: number;
  y: number;
  w: number;
  h: number;
} | null;

// FLIP zoom: when a cell is tapped, the new view starts pre-transformed so the
// new primary visually occupies the tapped cell's old rect, then animates to identity.
export function useFlipZoom(originRef: React.MutableRefObject<ZoomOrigin>, animationKey: unknown) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    const origin = originRef.current;
    if (!el || !origin) return;
    originRef.current = null;

    const containerRect = el.getBoundingClientRect();
    if (containerRect.width === 0) return;

    const scale = origin.w / containerRect.width;
    const tx = origin.x + origin.w / 2 - containerRect.width / 2;
    const ty = origin.y + origin.h / 2 - containerRect.height / 2;

    // Apply start state with transitions disabled and force a paint of it.
    el.style.transformOrigin = '50% 50%';
    el.style.transition = 'none';
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    el.style.opacity = '0.5';
    // Force the browser to commit the start state before scheduling the end state.
    void el.offsetHeight;

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!el) return;
        el.style.transition =
          'transform 380ms cubic-bezier(0.4, 0, 0.2, 1), opacity 280ms ease-out';
        el.style.transform = 'translate(0, 0) scale(1)';
        el.style.opacity = '1';
      });
    });

    const cleanup = () => {
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
      el.style.transformOrigin = '';
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === 'transform') {
        cleanup();
        el.removeEventListener('transitionend', onEnd);
      }
    };
    el.addEventListener('transitionend', onEnd);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      el.removeEventListener('transitionend', onEnd);
    };
  }, [animationKey, originRef]);

  return containerRef;
}
