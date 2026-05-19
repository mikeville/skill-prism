import { useEffect, useState } from 'react';

const BREAKPOINT_PX = 768;

// Callback-ref based: a RefObject would only be observed on the effect's first run; if the
// observed element mounts later (e.g. after the empty-state branch unmounts), the observer
// never reattaches. The callback ref triggers a state update whenever the element changes.
export function useContainerDepth(): {
  ref: (el: HTMLElement | null) => void;
  depth: 1 | 2;
} {
  const [el, setEl] = useState<HTMLElement | null>(null);
  // Seed from window width so the very first paint already matches the
  // viewport — avoids a one-frame "desktop layout on a mobile device" flash
  // before the ResizeObserver gets the container's clientWidth.
  const [depth, setDepth] = useState<1 | 2>(() =>
    typeof window !== 'undefined' && window.innerWidth > BREAKPOINT_PX ? 2 : 1,
  );

  useEffect(() => {
    if (!el) return;
    const update = () => setDepth(el.clientWidth > BREAKPOINT_PX ? 2 : 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);

  return { ref: setEl, depth };
}
