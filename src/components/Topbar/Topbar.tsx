import { useTypeMode } from '../../contexts/TypeMode';
import { ANYBODY } from '../../lib/fontConfig';
import type { DataState } from '../../types';
import { ExportButton } from '../Export/ExportButton';
import { Breadcrumb } from './Breadcrumb';
import { ColorPicker } from './ColorPicker';

// Tune the ABC mark here. Anybody axes: wdth [50–150], wght [100–900].
const ABC_POSTER = [
  { glyph: 'A', wdth: 150, wght: 900 }, // boldest + widest
  { glyph: 'B', wdth: 125, wght: 700 }, // middle
  { glyph: 'C', wdth:  100, wght: 500 }, // lightest + narrowest
] as const;
const ABC_PLAIN = { wdth: 100, wght: 500 } as const; // matches plain-mode cells

type Props = {
  path: string[];
  onJump: (idx: number) => void;
  onReset: () => void;
  data: DataState | null;
  // On mobile the breadcrumb is hoisted out of the center column and rendered
  // in the empty space above the grid (see App.tsx) — pass true there so the
  // topbar doesn't render its own copy.
  hideBreadcrumb?: boolean;
  // Desktop only: when provided, shows a panel-toggle icon next to Export.
  // `asideOpen` drives the icon's visual state (filled right slot when open).
  onToggleAside?: () => void;
  asideOpen?: boolean;
};

export function Topbar({
  path,
  onJump,
  onReset,
  data,
  hideBreadcrumb,
  onToggleAside,
  asideOpen,
}: Props) {
  const { mode, toggle } = useTypeMode();
  const poster = mode === 'poster';
  const showCrumbs = path.length >= 2 && !hideBreadcrumb;

  return (
    <div
      className="grid items-center shrink-0 px-4 md:px-6"
      style={{
        height: 'clamp(48px, 6vmin, 72px)',
        gridTemplateColumns: '1fr auto 1fr',
      }}
    >
      {/* Entrance animation lives on this wrapper, not the button. The
          brand-enter keyframe ends at opacity:1 with animation-fill-mode:both,
          which would otherwise pin the button's opacity and block hover:opacity-60
          from ever applying. Wrapper opacity * button opacity composes, so hover
          works freely on the inner element. */}
      <span
        className="justify-self-start"
        style={{ animation: 'brand-enter 220ms ease-out both' }}
      >
        <button
          type="button"
          onClick={onReset}
          className="text-meta font-meta text-ink-mut hover:opacity-60 transition-opacity duration-hover focus-ring"
          style={{
            // Match the EmptyState SKILL PRISM weight so the handoff stays visually consistent.
            fontFamily: ANYBODY.family,
            fontSize: '12px',
            fontVariationSettings: '"wdth" 100, "wght" 800',
            transform: 'translateY(-1px)'
          }}
        >
          SKILL PRISM
        </button>
      </span>
      <div className="justify-self-center min-w-0">
        {showCrumbs && <Breadcrumb path={path} onJump={onJump} />}
      </div>
      <div className="justify-self-end flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={poster}
          title={poster ? 'SWITCH TO PLAIN TYPOGRAPHY' : 'SWITCH TO POSTER TYPOGRAPHY'}
          className="text-meta font-meta text-ink-mut hover:opacity-60 transition-opacity duration-hover focus-ring leading-none flex items-center justify-center h-6"
        >
          {ABC_POSTER.map(({ glyph, wdth, wght }) => {
            const axes = poster ? ABC_PLAIN : { wdth, wght };
            return (
              <span
                key={glyph}
                style={{
                  fontFamily: ANYBODY.family,
                  fontVariationSettings: `"wdth" ${axes.wdth}, "wght" ${axes.wght}`,
                }}
              >
                {glyph}
              </span>
            );
          })}
        </button>
        <ColorPicker />
        <ExportButton data={data} topic={path[path.length - 1] ?? ''} />
        {onToggleAside && (
          <button
            type="button"
            onClick={onToggleAside}
            aria-pressed={asideOpen}
            aria-label={asideOpen ? 'HIDE INSIGHT PANEL' : 'SHOW INSIGHT PANEL'}
            title={asideOpen ? 'HIDE INSIGHT PANEL' : 'SHOW INSIGHT PANEL'}
            className="text-meta font-meta text-ink-mut hover:opacity-60 transition-opacity duration-hover focus-ring leading-none flex items-center justify-center h-6"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              aria-hidden
            >
              <rect x="0.5" y="2" width="13" height="10" />
              {asideOpen ? (
                <rect x="9" y="2" width="5" height="10" fill="currentColor" stroke="none" />
              ) : (
                <line x1="9" y1="2" x2="9" y2="12" />
              )}
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
