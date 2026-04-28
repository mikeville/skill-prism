// Root component. Owns navigation; delegates data + cache to useBreakdown,
// URL sync to usePath, runtime knobs to useTweaks. Tweaks panel is keystroke-gated (?).

import { useState, type CSSProperties } from 'react';
import { Breadcrumb } from './components/Breadcrumb';
import { EmptyState } from './components/EmptyState';
import { HaradaGrid, type CellClickPayload } from './components/HaradaGrid';
import { TweaksPanel } from './components/tweaks/TweaksPanel';
import {
  TweakColor,
  TweakRadio,
  TweakSection,
  TweakSelect,
  TweakSlider,
  TweakToggle,
} from './components/tweaks/controls';
import { useBreakdown } from './hooks/useBreakdown';
import { usePath } from './hooks/usePath';
import { FONT_STACKS, useTweaks } from './hooks/useTweaks';
import { useTweaksPanelOpen } from './hooks/useTweaksPanelOpen';
import styles from './App.module.css';

export default function App() {
  const [path, setPath] = usePath();
  const [zoomKey, setZoomKey] = useState(0);
  const [tweaks, setTweak] = useTweaks();
  const [tweaksOpen, setTweaksOpen] = useTweaksPanelOpen();

  const { data, regenerating, error } = useBreakdown(path);
  const fontStack = FONT_STACKS[tweaks.fontFamily];

  const navigate = (next: string[]) => {
    setPath(next);
    setZoomKey((k) => k + 1);
  };

  const handleSubmit = (topic: string) => navigate([topic]);

  const handleCellClick = (p: CellClickPayload) => {
    const next = p.kind === 'leaf' ? [...path, p.anchor, p.term] : [...path, p.term];
    navigate(next);
  };

  const handleJump = (idx: number) => {
    if (idx >= path.length - 1) return;
    navigate(path.slice(0, idx + 1));
  };

  const handleReset = () => navigate([]);

  const inEmpty = path.length === 0;
  const rootStyle = {
    '--accent': tweaks.accent,
    background: tweaks.background,
    fontFamily: fontStack,
  } as CSSProperties;

  return (
    <>
      <div className={styles.root} style={rootStyle}>
        {inEmpty ? (
          <EmptyState onSubmit={handleSubmit} accent={tweaks.accent} fontStack={fontStack} />
        ) : (
          <div className={styles.shell}>
            <div className={styles.topbar}>
              <button type="button" onClick={handleReset} className={styles.resetButton}>
                ◂ Ohtani
              </button>
              <Breadcrumb
                path={path}
                onJump={handleJump}
                accent={tweaks.accent}
                fontStack={fontStack}
                regenerating={regenerating}
              />
            </div>

            <div className={styles.gridArea}>
              <div key={zoomKey} className={styles.gridShell}>
                <HaradaGrid
                  data={data}
                  onCellClick={handleCellClick}
                  showCoords={tweaks.showCoords}
                  accent={tweaks.accent}
                  density={tweaks.density}
                  fontStack={fontStack}
                  lineWeight={tweaks.lineWeight}
                  zoomKey={zoomKey}
                />
                {error && (
                  <div
                    className={styles.errorTag}
                    style={{ color: tweaks.accent, borderColor: tweaks.accent }}
                  >
                    {error}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.footer}>
              <span>tap any cell to descend</span>
            </div>
          </div>
        )}
      </div>

      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)}>
        <TweakSection label="Accent" />
        <TweakColor
          label="Color"
          value={tweaks.accent}
          onChange={(v) => setTweak('accent', v)}
        />
        <TweakSection label="Type" />
        <TweakSelect
          label="Family"
          value={tweaks.fontFamily}
          options={['Inter', 'Manrope', 'System'] as const}
          onChange={(v) => setTweak('fontFamily', v)}
        />
        <TweakSection label="Grid" />
        <TweakRadio
          label="Density"
          value={tweaks.density}
          options={['compact', 'comfortable'] as const}
          onChange={(v) => setTweak('density', v)}
        />
        <TweakSlider
          label="Line weight"
          value={tweaks.lineWeight}
          min={0.5}
          max={2.5}
          step={0.25}
          onChange={(v) => setTweak('lineWeight', v)}
        />
        <TweakToggle
          label="Show coordinates"
          value={tweaks.showCoords}
          onChange={(v) => setTweak('showCoords', v)}
        />
        <TweakSection label="Background" />
        <TweakColor
          label="Paper"
          value={tweaks.background}
          onChange={(v) => setTweak('background', v)}
        />
      </TweaksPanel>
    </>
  );
}
