type Props = {
  path: string[];
  onJump: (idx: number) => void;
  // When true, every node + separator is rendered in the main ink color
  // (used by the mobile breadcrumb row above the grid). When false (default),
  // everything renders in ink-mut, with hover restoring ink on clickable nodes
  // — the existing desktop treatment in the topbar's center column.
  allInk?: boolean;
};

export function Breadcrumb({ path, onJump, allInk }: Props) {
  const nodeColor = allInk ? 'text-ink' : 'text-ink-mut';
  const sepColor = allInk ? 'text-ink' : 'text-ink-mut';
  const hoverColor = allInk ? '' : 'hover:text-ink transition-colors duration-hover';
  return (
    <div className="flex items-center gap-3 min-w-0 text-meta font-meta">
      {path.map((node, i) => {
        const isLast = i === path.length - 1;
        return (
          <span key={i} className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => !isLast && onJump(i)}
              disabled={isLast}
              className={
                isLast
                  ? `${nodeColor} cursor-default truncate`
                  : `${nodeColor} ${hoverColor} focus-ring truncate`
              }
            >
              {node}
            </button>
            {!isLast && <span className={`${sepColor} select-none`}>›</span>}
          </span>
        );
      })}
    </div>
  );
}
