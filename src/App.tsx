import { useEffect, useRef } from 'react';
import { EmptyState } from './components/EmptyState/EmptyState';
import { FractalView } from './components/FractalView/FractalView';
import type { CellClick } from './components/FractalView/Level';
import type { ZoomIntent } from './components/FractalView/FractalView';
import { Topbar } from './components/Topbar/Topbar';
import { TypeModeProvider } from './contexts/TypeMode';
import { useBreakdown } from './hooks/useBreakdown';
import { useContainerDepth } from './hooks/useContainerDepth';
import { usePath } from './hooks/usePath';
import { cacheGet } from './lib/cache';

export default function App() {
  return (
    <TypeModeProvider>
      <AppInner />
    </TypeModeProvider>
  );
}

// All cells (corner + 3×3 + 9×9) share the viewport's aspect ratio when the
// layout is full-bleed: corner_w / corner_h = V_w / V_h falls out of the geometry.
// Track viewport aspect and expose it as --inner-aspect for corner widths.
function useViewportAspect() {
  useEffect(() => {
    const update = () => {
      document.documentElement.style.setProperty(
        '--inner-aspect',
        String(window.innerWidth / window.innerHeight),
      );
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
}

function AppInner() {
  const [path, setPath] = usePath();
  const { data, regenerating, error } = useBreakdown(path);
  const { ref: gridContainerRef, depth } = useContainerDepth();
  useViewportAspect();
  const zoomIntent = useRef<ZoomIntent | null>(null);

  const handleSubmit = (topic: string) => {
    zoomIntent.current = null;
    setPath([topic]);
  };

  const handleCellClick = (c: CellClick) => {
    if (!data) return;
    const next =
      c.kind === 'tertiary'
        ? [...path, data.mains[c.mainIdx], data.subs[c.mainIdx][c.subIdx]]
        : [...path, data.mains[c.mainIdx]];
    setPath(next);
  };

  const handleJump = (idx: number) => {
    if (idx >= path.length - 1) return;
    const newPath = path.slice(0, idx + 1);
    const targetTerm = path[idx + 1];
    const parentBreakdown = cacheGet(newPath);
    const mainsIdx = parentBreakdown ? parentBreakdown.mains.indexOf(targetTerm) : -1;
    zoomIntent.current = mainsIdx >= 0 ? { kind: 'out', mainsIdx } : null;
    setPath(newPath);
  };

  const handleReset = () => {
    zoomIntent.current = null;
    setPath([]);
  };

  const inEmpty = path.length === 0;

  return (
    <div className="fixed inset-0 bg-fill-page text-ink overflow-hidden">
      {inEmpty ? (
        <EmptyState onSubmit={handleSubmit} />
      ) : (
        <div
          ref={gridContainerRef}
          className="absolute inset-0 flex flex-col"
        >
          <div
            aria-hidden
            className="absolute left-0 right-0 h-px bg-line-meta pointer-events-none z-10"
            style={{ top: 'clamp(48px, 6vmin, 72px)' }}
          />
          <div
            aria-hidden
            className="absolute left-0 right-0 h-px bg-line-meta pointer-events-none z-10"
            style={{ bottom: 'clamp(48px, 6vmin, 72px)' }}
          />
          <div
            aria-hidden
            className="absolute top-0 bottom-0 w-px bg-line-meta pointer-events-none z-10"
            style={{ left: 'calc(clamp(48px, 6vmin, 72px) * var(--inner-aspect, 1))' }}
          />
          <div
            aria-hidden
            className="absolute top-0 bottom-0 w-px bg-line-meta pointer-events-none z-10"
            style={{ right: 'calc(clamp(48px, 6vmin, 72px) * var(--inner-aspect, 1))' }}
          />
          <Topbar
            path={path}
            onJump={handleJump}
            onReset={handleReset}
            regenerating={regenerating}
          />
          <div className="relative flex-1 min-h-0">
            <FractalView
              data={data}
              depth={depth}
              onCellClick={handleCellClick}
              zoomIntent={zoomIntent}
            />
            {error && (
              <div className="absolute bottom-4 left-8 bg-paper border-cell border-ink px-2 py-1 text-meta font-meta">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
