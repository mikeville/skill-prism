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
      {canOpenSkill && (
        <button
          type="button"
          onClick={onToggleSkill}
          aria-pressed={skillOpen}
          className={[
            'ml-auto text-secondary font-secondary text-ink hover:opacity-60 transition-opacity duration-hover',
            skillOpen ? 'border-cell border-line px-2 py-0.5' : '',
          ].join(' ')}
        >
          {skillOpen ? 'Skill draft ✕' : 'Skill draft ▸'}
        </button>
      )}
    </div>
  );
}
