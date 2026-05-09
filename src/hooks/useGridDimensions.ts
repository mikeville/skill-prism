import { useEffect, useState } from 'react';

const BREAKPOINT_PX = 768;

export type GridDims = {
  containerWidth: number;
  containerHeight: number;
  // The persistent shell box's width: matches the primary cell on desktop, the
  // entire outer grid frame on mobile. Width stays constant across empty/active
  // states so the input box and primary-cell-or-frame share a width from the start.
  morphTargetWidth: number;
  morphTargetHeight: number;
  topbarHeight: number;
  isMobile: boolean;
};

export function useGridDimensions(): GridDims {
  const [dims, setDims] = useState<GridDims>(() =>
    typeof window === 'undefined' ? defaultDims() : compute(),
  );

  useEffect(() => {
    const update = () => setDims(compute());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return dims;
}

function defaultDims(): GridDims {
  return {
    containerWidth: 1280,
    containerHeight: 720,
    morphTargetWidth: 425,
    morphTargetHeight: 240,
    topbarHeight: 60,
    isMobile: false,
  };
}

function compute(): GridDims {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isMobile = vw <= BREAKPOINT_PX;

  // Mirror FractalView.tsx (paddingBottom + paddingLeft/Right) and Topbar.tsx
  // (height): clamp(48px, 6vmin, 72px) base, scaled by viewport aspect on the
  // horizontal axis. Computed before FractalView mounts so the empty-state
  // shell can size itself to match what the cell/frame will be.
  const sixVmin = 0.06 * Math.min(vw, vh);
  const base = clamp(48, sixVmin, 72);
  const padLR = base * (vw / vh);

  const containerWidth = vw - 2 * padLR;
  const containerHeight = vh - base - base;

  if (isMobile) {
    return {
      containerWidth,
      containerHeight,
      morphTargetWidth: containerWidth,
      morphTargetHeight: containerHeight,
      topbarHeight: base,
      isMobile: true,
    };
  }

  // Outer 3×3 with gap-px (2px between 3 tracks) and p-px (2px outer padding):
  // each cell = (container - 4) / 3.
  return {
    containerWidth,
    containerHeight,
    morphTargetWidth: (containerWidth - 4) / 3,
    morphTargetHeight: (containerHeight - 4) / 3,
    topbarHeight: base,
    isMobile: false,
  };
}

function clamp(min: number, val: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
