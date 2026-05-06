import { useTypeMode } from '../../contexts/TypeMode';
import { ANYBODY } from '../../lib/fontConfig';
import { Breadcrumb } from './Breadcrumb';

type Props = {
  path: string[];
  onJump: (idx: number) => void;
  onReset: () => void;
  regenerating: boolean;
  canOpenSkill: boolean;
  skillOpen: boolean;
  onToggleSkill: () => void;
};

export function Topbar({
  path,
  onJump,
  onReset,
  regenerating,
  canOpenSkill,
  skillOpen,
  onToggleSkill,
}: Props) {
  const { mode, toggle } = useTypeMode();
  const poster = mode === 'poster';

  return (
    <div className="flex items-center gap-6 px-8 h-[62px] bg-fill-page border-b border-line shrink-0">
      <button
        type="button"
        onClick={onReset}
        className="text-secondary font-secondary text-ink hover:opacity-60 transition-opacity duration-hover"
      >
        Ohtani
      </button>
      <Breadcrumb path={path} onJump={onJump} regenerating={regenerating} />
      <div className="ml-auto flex items-center gap-2">
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
      {canOpenSkill && (
        <button
          type="button"
          onClick={onToggleSkill}
          aria-pressed={skillOpen}
          className={[
            'text-secondary font-secondary text-ink hover:opacity-60 transition-opacity duration-hover',
            skillOpen ? 'border-cell border-line px-2 py-0.5' : '',
          ].join(' ')}
        >
          {skillOpen ? 'Skill draft ✕' : 'Skill draft ▸'}
        </button>
      )}
    </div>
  );
}
