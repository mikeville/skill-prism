import { forwardRef, useMemo } from 'react';
import { AnimatingProvider } from '../../contexts/Animating';
import type { DataState } from '../../types';
import { buildTree } from '../../lib/fractalTree';
import { Level } from '../FractalView/Level';

// Offscreen render of the poster at fixed export dimensions. Mounts into a
// hidden portal host, replicates the live perimeter framing (without topbar
// or breadcrumbs), and overrides --inner-aspect locally so cell sizing matches
// the export aspect rather than the actual browser viewport.
//
// The TypeModeProvider from App wraps the portal host so the user's
// poster/plain choice flows through automatically. We supply a stub
// AnimatingProvider locally so useFitText runs eagerly (no live zoom to wait
// on).

type Props = {
  data: DataState | null;
  width: number;
  height: number;
};

// Stable stub — the export tree never animates.
const STUB_ANIMATING = {
  isAnimating: () => false,
  onChange: () => () => {},
};

export const ExportCanvas = forwardRef<HTMLDivElement, Props>(function ExportCanvas(
  { data, width, height },
  ref,
) {
  const tree = useMemo(() => buildTree(data), [data]);
  const aspect = width / height;
  // Mirror the live app's framing margin: clamp(48px, 6vmin, 72px) in CSS,
  // computed against the export dimensions so it matches what the user sees
  // on screen at the same aspect (rather than the actual browser viewport).
  const margin = Math.min(72, Math.max(48, Math.min(width, height) * 0.06));
  const sideMargin = margin * aspect;

  return (
    <div
      ref={ref}
      className="bg-paper text-ink relative overflow-hidden"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        ['--inner-aspect' as string]: String(aspect),
        // Tailwind body defaults that the live page sets globally.
        fontFamily: '"Anybody Variable", Inter, sans-serif',
        textTransform: 'uppercase',
        fontVariationSettings: '"wdth" 100, "wght" 450',
      }}
    >
      {/* Perimeter hairlines — same layout as App.tsx perimeter divs. */}
      <div
        aria-hidden
        className="absolute left-0 right-0 bg-line-meta pointer-events-none"
        style={{ top: `${margin}px`, height: '1px' }}
      />
      <div
        aria-hidden
        className="absolute left-0 right-0 bg-line-meta pointer-events-none"
        style={{ bottom: `${margin}px`, height: '1px' }}
      />
      <div
        aria-hidden
        className="absolute top-0 bottom-0 bg-line-meta pointer-events-none"
        style={{ left: `${sideMargin}px`, width: '1px' }}
      />
      <div
        aria-hidden
        className="absolute top-0 bottom-0 bg-line-meta pointer-events-none"
        style={{ right: `${sideMargin}px`, width: '1px' }}
      />
      {/* Grid area — sits between the perimeter lines. The Level at depth=2
          paints its own outer frame (bg-line-meta hairline grid). */}
      <div
        className="absolute"
        style={{
          top: `${margin}px`,
          bottom: `${margin}px`,
          left: `${sideMargin}px`,
          right: `${sideMargin}px`,
        }}
      >
        <AnimatingProvider value={STUB_ANIMATING}>
          <Level
            node={tree}
            depth={2}
            loading={false}
            onCellClick={() => {}}
          />
        </AnimatingProvider>
      </div>
    </div>
  );
});
