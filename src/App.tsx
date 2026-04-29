import { useRef } from 'react';
import { EmptyState } from './components/EmptyState/EmptyState';
import { FractalView } from './components/FractalView/FractalView';
import type { CellClick } from './components/FractalView/Level';
import type { ZoomOrigin } from './components/FractalView/FractalView';
import { Topbar } from './components/Topbar/Topbar';
import { useBreakdown } from './hooks/useBreakdown';
import { usePath } from './hooks/usePath';
import { useViewportDepth } from './hooks/useViewportDepth';

export default function App() {
  const [path, setPath] = usePath();
  const { data, regenerating, error } = useBreakdown(path);
  const depth = useViewportDepth();
  const zoomOrigin = useRef<ZoomOrigin>(null);

  const handleSubmit = (topic: string) => {
    zoomOrigin.current = null;
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
    zoomOrigin.current = null;
    setPath(path.slice(0, idx + 1));
  };

  const handleReset = () => {
    zoomOrigin.current = null;
    setPath([]);
  };

  const inEmpty = path.length === 0;

  return (
    <div className="fixed inset-0 bg-fill-page text-ink overflow-hidden">
      {inEmpty ? (
        <EmptyState onSubmit={handleSubmit} />
      ) : (
        <div className="absolute inset-0 flex flex-col">
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
              zoomOrigin={zoomOrigin}
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
