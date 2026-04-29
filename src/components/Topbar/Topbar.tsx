import { Breadcrumb } from './Breadcrumb';

type Props = {
  path: string[];
  onJump: (idx: number) => void;
  onReset: () => void;
  regenerating: boolean;
};

export function Topbar({ path, onJump, onReset, regenerating }: Props) {
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
    </div>
  );
}
