import { useMemo, useRef, useState } from 'react';
import { EmptyState } from './components/EmptyState/EmptyState';
import { FractalView } from './components/FractalView/FractalView';
import type { CellClick } from './components/FractalView/Level';
import type { ZoomIntent } from './components/FractalView/FractalView';
import { SkillSidebar } from './components/SkillSidebar/SkillSidebar';
import { Topbar } from './components/Topbar/Topbar';
import { TypeModeProvider } from './contexts/TypeMode';
import { useBreakdown } from './hooks/useBreakdown';
import { useContainerDepth } from './hooks/useContainerDepth';
import { usePath } from './hooks/usePath';
import { cacheGet } from './lib/cache';
import { buildSkillMarkdown } from './lib/exportSkill';

export default function App() {
  return (
    <TypeModeProvider>
      <AppInner />
    </TypeModeProvider>
  );
}

function AppInner() {
  const [path, setPath] = usePath();
  const { data, regenerating, error } = useBreakdown(path);
  const { ref: gridContainerRef, depth } = useContainerDepth();
  const zoomIntent = useRef<ZoomIntent | null>(null);
  const [skillOpen, setSkillOpen] = useState(false);

  const skillMarkdown = useMemo(
    () => (data ? buildSkillMarkdown(path, data) : ''),
    [path, data],
  );

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
        <div className="absolute inset-0 flex">
          <div ref={gridContainerRef} className="flex flex-col flex-1 min-w-0">
            <Topbar
              path={path}
              onJump={handleJump}
              onReset={handleReset}
              regenerating={regenerating}
              canOpenSkill={!!data}
              skillOpen={skillOpen}
              onToggleSkill={() => setSkillOpen((v) => !v)}
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
          <SkillSidebar
            markdown={skillMarkdown}
            open={skillOpen}
            onClose={() => setSkillOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
