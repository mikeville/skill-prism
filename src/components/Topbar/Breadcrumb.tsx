import { Fragment } from 'react';

type Props = {
  path: string[];
  onJump: (idx: number) => void;
  // When true, every node renders in the main ink color (used by the mobile
  // breadcrumb row above the grid). When false (default), nodes render in
  // ink-mut with hover restoring ink on clickable nodes — the desktop
  // treatment in the topbar's center column.
  allInk?: boolean;
};

// Per-segment flex-shrink priority so the trailing segment (the current term —
// the most context-relevant one) keeps its space until the earlier segments
// have fully ellipsized. Segments are still all visible; only their character
// count shrinks.
//
// Higher value = shrinks faster. 0 = doesn't shrink at all.
function shrinkPriority(index: number, total: number): number {
  if (index === total - 1) return 1;        // last (current) — shrink last
  if (index === 0) return 4;                // first (root topic) — shrink first
  return 3;                                  // any middle nodes
}

export function Breadcrumb({ path, onJump, allInk }: Props) {
  const nodeColor = allInk ? 'text-ink' : 'text-ink-mut';
  const hoverColor = allInk ? '' : 'hover:text-ink transition-colors duration-hover';
  // Arrows are intentionally lighter than the labels in both desktop and
  // mobile contexts — they're connective punctuation, not content. line-meta
  // gives a visible-but-quiet hairline-grade tone that contrasts with both
  // the desktop ink-mut and the mobile ink text colors.
  const sepColor = 'text-line-meta';

  return (
    <div
      // Flat flex layout: buttons and separators are direct siblings, so one
      // `gap` value controls all spacing. text-meta is the global UI label
      // size (9px) — same token used by the insight pane's kind labels and
      // topbar UI text, so the breadcrumb stays consistent with the rest of
      // the meta ladder.
      className="flex items-baseline gap-1 min-w-0 max-w-full font-meta text-meta"
    >
      {path.map((node, i) => {
        const isLast = i === path.length - 1;
        return (
          <Fragment key={i}>
            <button
              type="button"
              onClick={() => !isLast && onJump(i)}
              disabled={isLast}
              title={node}
              style={{
                flexShrink: shrinkPriority(i, path.length),
                flexGrow: 0,
                flexBasis: 'auto',
                minWidth: 0,
              }}
              className={
                isLast
                  ? `${nodeColor} cursor-default truncate`
                  : `${nodeColor} ${hoverColor} focus-ring truncate`
              }
            >
              {node}
            </button>
            {!isLast && (
              <span className={`${sepColor} select-none shrink-0`} aria-hidden>
                ›
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
