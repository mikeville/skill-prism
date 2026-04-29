import { useEffect, useState } from 'react';

type Props = {
  path: string[];
  onJump: (idx: number) => void;
  regenerating: boolean;
};

export function Breadcrumb({ path, onJump, regenerating }: Props) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-meta">
      {path.map((node, i) => {
        const isLast = i === path.length - 1;
        return (
          <span key={i} className="flex items-baseline gap-x-2">
            <button
              type="button"
              onClick={() => !isLast && onJump(i)}
              disabled={isLast}
              className={
                isLast
                  ? 'text-ink font-secondary cursor-default'
                  : 'text-ink-mut hover:text-ink transition-colors duration-hover'
              }
            >
              {node}
            </button>
            {!isLast && <span className="text-ink-faint select-none">/</span>}
          </span>
        );
      })}
      {regenerating && (
        <span className="text-meta text-ink-mut flex items-center gap-1 ml-2">
          <Pulse /> regenerating
        </span>
      )}
    </div>
  );
}

function Pulse() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => (x + 1) % 4), 250);
    return () => clearInterval(id);
  }, []);
  return <span className="inline-block w-5 text-left">{'·'.repeat(t)}</span>;
}
