import type { Insight, ResourceKind } from '../../lib/insightApi';

type Props = {
  term: string;
  insight: Insight | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  // Compact layout: smaller padding + tighter spacing for the mobile bottom panel.
  compact?: boolean;
};

const KIND_LABEL: Record<ResourceKind, string> = {
  book: 'BOOK',
  course: 'COURSE',
  person: 'PERSON',
  community: 'COMMUNITY',
  site: 'SITE',
};

export function InsightContent({ term, insight, loading, error, onRetry, compact }: Props) {
  const pad = compact ? 'px-4 py-3' : 'p-6';
  const gap = compact ? 'gap-3' : 'gap-5';
  const sectionGap = compact ? 'gap-1.5' : 'gap-2';

  return (
    <div className={`flex flex-col ${gap} ${pad}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-meta font-meta text-ink-mut">WHAT NOW</span>
        <span className="text-meta font-meta text-ink truncate" title={term}>
          {term}
        </span>
      </div>

      {loading && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <div className="h-3 w-3/4 animate-skeleton" />
          <div className="h-3 w-2/3 animate-skeleton" />
          <div className="h-3 w-1/2 animate-skeleton" />
        </div>
      )}

      {error && !loading && (
        <div className={`flex flex-col ${sectionGap}`}>
          <p className="text-meta font-meta text-ink">COULDN'T LOAD</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-meta font-meta text-ink-mut hover:opacity-60 transition-opacity duration-hover focus-ring self-start"
            >
              TRY AGAIN
            </button>
          )}
        </div>
      )}

      {insight && !loading && !error && (
        <>
          {insight.framing && (
            <p className="text-meta font-meta text-ink leading-relaxed normal-case">
              {insight.framing}
            </p>
          )}

          {insight.resources.length > 0 && (
            <div className={`flex flex-col ${sectionGap}`}>
              <span className="text-meta font-meta text-ink-mut">RESOURCES</span>
              <ul className="flex flex-col gap-2">
                {insight.resources.map((r, i) => (
                  <li key={i} className="flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-meta font-meta text-ink-mut shrink-0">
                        {KIND_LABEL[r.kind]}
                      </span>
                      <span className="text-meta font-meta text-ink">{r.title}</span>
                    </div>
                    {r.note && (
                      <p className="text-meta font-meta text-ink-mut normal-case leading-snug">
                        {r.note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insight.actions.length > 0 && (
            <div className={`flex flex-col ${sectionGap}`}>
              <span className="text-meta font-meta text-ink-mut">FIRST MOVES</span>
              <ol className="flex flex-col gap-1.5">
                {insight.actions.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-meta font-meta text-ink-mut shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-meta font-meta text-ink">{a}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}
