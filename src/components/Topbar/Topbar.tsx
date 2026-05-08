import { useTypeMode } from '../../contexts/TypeMode';
import { ANYBODY } from '../../lib/fontConfig';
import { Breadcrumb } from './Breadcrumb';

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
        className="text-secondary font-secondary text-ink hover:opacity-60 transition-opacity duration-hover justify-self-start"
      >
        Skill Prism
      </button>
      <div className="justify-self-center min-w-0">
        {showCrumbs && <Breadcrumb path={path} onJump={onJump} regenerating={regenerating} />}
      </div>
      <div className="justify-self-end flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={poster}
          title={poster ? 'Switch to plain typography' : 'Switch to poster typography'}
          className={[
            'text-secondary text-ink hover:opacity-60 transition-opacity duration-hover',
            'leading-none px-2 py-0.5 border-cell',
            poster ? 'border-ink' : 'border-line',
          ].join(' ')}
          style={
            poster
              ? {
                  fontVariationSettings: `"wdth" ${ANYBODY.aaPreview.wdth}, "wght" ${ANYBODY.aaPreview.wght}`,
                }
              : undefined
          }
        >
          Aa
        </button>
      </div>
    </div>
  );
}
