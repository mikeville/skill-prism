import { useEffect, useState } from 'react';
import type { TweakValues } from '../types';

const BREAKPOINT_PX = 768;

function detect(): 1 | 2 {
  if (typeof window === 'undefined') return 2;
  return window.matchMedia(`(min-width: ${BREAKPOINT_PX + 1}px)`).matches ? 2 : 1;
}

export function useViewportDepth(override: TweakValues['depthOverride'] = 'auto'): 1 | 2 {
  const [depth, setDepth] = useState<1 | 2>(detect);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${BREAKPOINT_PX + 1}px)`);
    const update = () => setDepth(mql.matches ? 2 : 1);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  if (override === '1') return 1;
  if (override === '2') return 2;
  return depth;
}
