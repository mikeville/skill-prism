import { useEffect, useState } from 'react';
import { useInsight } from '../../hooks/useInsight';
import { InsightContent } from './InsightContent';

type Props = {
  // Full path including the focal term (last element). The panel resolves
  // (parentPath, focalTerm) internally so the cache key matches what the
  // desktop drawer would have used for the same center cell.
  path: string[];
};

// Mobile bottom panel: always-mounted, slides up from the bottom edge. Locked
// to the current center/focal term — re-fetches as the user drills.
//
// Collapse state is persisted within the session via state (not localStorage)
// so a first-time visitor sees the open panel.
export function InsightPanel({ path }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const term = path.length > 0 ? path[path.length - 1] : null;
  const parentPath = path.slice(0, -1);

  // Reset retry counter when the target term changes.
  useEffect(() => {
    setRetryKey(0);
  }, [term]);

  const { insight, loading, error } = useInsight(term ? parentPath : null, term);

  if (!term) return null;

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-30 bg-paper border-t border-line-meta pointer-events-auto flex flex-col"
      style={{
        boxShadow: '0 -12px 32px rgba(0,0,0,0.18)',
        maxHeight: '60vh',
      }}
    >
      {/* Drag/tap handle: tap row to expand or collapse. */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between px-4 py-2 border-b border-line-meta focus-ring-inset"
        aria-expanded={!collapsed}
        aria-controls="insight-panel-body"
      >
        <span className="flex items-center gap-2">
          <span className="text-meta font-meta text-ink-mut">WHAT NOW</span>
          <span className="text-meta font-meta text-ink truncate max-w-[55vw]">{term}</span>
        </span>
        <span
          aria-hidden
          className="text-meta font-meta text-ink-mut transition-transform duration-hover"
          style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
        >
          {/* Chevron — up means "tap to collapse", down means "tap to expand". */}
          ▾
        </span>
      </button>
      {!collapsed && (
        <div id="insight-panel-body" className="flex-1 min-h-0 overflow-y-auto">
          <InsightContent
            key={retryKey}
            term={term}
            insight={insight}
            loading={loading}
            error={error}
            onRetry={() => setRetryKey((k) => k + 1)}
            compact
          />
        </div>
      )}
    </div>
  );
}
