import { Breadcrumb } from './Breadcrumb';

type Props = {
  path: string[];
  onJump: (idx: number) => void;
  onReset: () => void;
  regenerating: boolean;
};

export function Topbar({ path, onJump, onReset, regenerating }: Props) {
  return (
    <div className="flex flex-col gap-2 min-w-0 px-4 md:px-7 pt-4 md:pt-5">
      <button
        type="button"
        onClick={onReset}
        className="self-start text-meta text-ink-mut hover:text-ink transition-colors duration-hover"
      >
        ◂ Ohtani
      </button>
      <Breadcrumb path={path} onJump={onJump} regenerating={regenerating} />
    </div>
  );
}
