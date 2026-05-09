import { useTypeMode } from '../../contexts/TypeMode';
import { ANYBODY } from '../../lib/fontConfig';
import { Breadcrumb } from './Breadcrumb';

// Tune the ABC mark here. Anybody axes: wdth [50–150], wght [100–900].
const ABC_POSTER = [
  { glyph: 'A', wdth: 150, wght: 900 }, // boldest + widest
  { glyph: 'B', wdth: 125, wght: 600 }, // middle
  { glyph: 'C', wdth:  100, wght: 300 }, // lightest + narrowest
] as const;
const ABC_PLAIN = { wdth: 100, wght: 500 } as const; // matches plain-mode cells

type Props = {
  path: string[];
  onJump: (idx: number) => void;
  onReset: () => void;
  regenerating: boolean;
};

export function Topbar({ path, onJump, onReset, regenerating }: Props) {
  const { mode, toggle } = useTypeMode();
  const poster = mode === 'poster';
  const showCrumbs = path.length >= 2;

  return (
    <div
      className="grid items-center shrink-0"
      style={{
        height: 'clamp(48px, 6vmin, 72px)',
        gridTemplateColumns: '1fr auto 1fr',
        paddingLeft: 'calc(clamp(48px, 6vmin, 72px) * var(--inner-aspect, 1) + 1rem)',
        paddingRight: 'calc(clamp(48px, 6vmin, 72px) * var(--inner-aspect, 1) + 1rem)',
      }}
    >
      <button
        type="button"
        onClick={onReset}
        className="text-meta font-meta text-ink hover:opacity-60 transition-opacity duration-hover justify-self-start"
      >
        SKILL PRISM
      </button>
      <div className="justify-self-center min-w-0">
        {showCrumbs && <Breadcrumb path={path} onJump={onJump} regenerating={regenerating} />}
      </div>
      <div className="justify-self-end flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={poster}
          title={poster ? 'SWITCH TO PLAIN TYPOGRAPHY' : 'SWITCH TO POSTER TYPOGRAPHY'}
          className="text-meta font-meta text-ink hover:opacity-60 transition-opacity duration-hover leading-none"
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
      </div>
    </div>
  );
}
