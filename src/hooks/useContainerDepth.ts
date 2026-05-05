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
  const [depth, setDepth] = useState<1 | 2>(2);

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
