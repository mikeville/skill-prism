import { useMemo, useRef } from 'react';
import { EmptyState } from './components/EmptyState/EmptyState';
import { FractalView } from './components/FractalView/FractalView';
import type { CellClick } from './components/FractalView/Level';
import type { ZoomOrigin } from './components/FractalView/useFlipZoom';
import { Topbar } from './components/Topbar/Topbar';
import { TweaksPanel } from './components/TweaksPanel/TweaksPanel';
import { TweakRadio, TweakSection, TweakToggle } from './components/TweaksPanel/controls';
import { useBreakdown } from './hooks/useBreakdown';
import { usePath } from './hooks/usePath';
import { useTweaks } from './hooks/useTweaks';
import { useTweaksPanelOpen } from './hooks/useTweaksPanelOpen';
import { useViewportDepth } from './hooks/useViewportDepth';

export default function App() {
  const [path, setPath] = usePath();
  const [tweaks, setTweak] = useTweaks();
  const [tweaksOpen, setTweaksOpen] = useTweaksPanelOpen();
  const { data, regenerating, error } = useBreakdown(path);
  const depth = useViewportDepth(tweaks.depthOverride);
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
  const pathKey = useMemo(() => JSON.stringify(path), [path]);

  return (
    <>
      <div className="fixed inset-0 bg-paper text-ink overflow-hidden">
        {inEmpty ? (
          <EmptyState onSubmit={handleSubmit} />
        ) : (
          <div className="absolute inset-0 flex flex-col gap-3 md:gap-4">
            <Topbar
              path={path}
              onJump={handleJump}
              onReset={handleReset}
              regenerating={regenerating}
            />
            <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 md:px-7 pb-4 md:pb-6">
              <FractalView
                data={data}
                depth={depth}
                onCellClick={handleCellClick}
                zoomKey={pathKey}
                zoomOrigin={zoomOrigin}
              />
              {error && (
                <div className="absolute bottom-2 left-4 md:left-7 bg-paper border-cell border-ink px-2 py-1 text-meta">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {!inEmpty && (
        <button
          type="button"
          aria-label="Open tweaks"
          onClick={() => setTweaksOpen(!tweaksOpen)}
          className="fixed z-30 bottom-4 right-4 w-9 h-9 border-cell border-ink bg-paper text-ink hover:bg-gold-secondary transition-colors duration-hover text-meta font-secondary"
        >
          ?
        </button>
      )}

      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)}>
        <TweakSection label="Grid" />
        <TweakRadio
          label="Density"
          value={tweaks.density}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Comfortable' },
          ]}
          onChange={(v) => setTweak('density', v)}
        />
        <TweakRadio
          label="Depth"
          value={tweaks.depthOverride}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: '1', label: '1' },
            { value: '2', label: '2' },
          ]}
          onChange={(v) => setTweak('depthOverride', v)}
        />
        <TweakToggle
          label="Show coords"
          value={tweaks.showCoords}
          onChange={(v) => setTweak('showCoords', v)}
        />
      </TweaksPanel>
    </>
  );
}

