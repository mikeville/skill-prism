import { useEffect, useState } from 'react';
import type { Insight, ResourceKind } from '../../lib/insightApi';

type Props = {
  term: string;
  insight: Insight | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  // Desktop only: dismiss handler. Renders a CLOSE button next to TO MASTER
  // so the user always has a clear way to collapse the panel from inside it.
  onClose?: () => void;
  // Compact: smaller padding for tighter contexts (currently unused in the
  // new always-visible layout, but kept for future flexibility).
  compact?: boolean;
};

const KIND_LABEL: Record<ResourceKind, string> = {
  book: 'BOOK',
  course: 'COURSE',
  person: 'PERSON',
  community: 'COMMUNITY',
  site: 'SITE',
};

// Body-copy style for prose inside the panel. Conventional readable axes for
// Anybody Variable: width 100 (normal), weight 400 (regular). Combined with
// `normal-case` to opt out of the global uppercase rule.
const PROSE_STYLE: React.CSSProperties = {
  fontVariationSettings: '"wdth" 100, "wght" 400',
  lineHeight: 1.5,
};

const PROSE_CLASS = 'normal-case text-ink';

export function InsightContent({
  term,
  insight,
  loading,
  error,
  onRetry,
  onClose,
  compact,
}: Props) {
  const pad = compact ? 'px-4 py-4' : 'px-6 py-6';
  const sectionGap = 'gap-5';

  // Per-move expanded state. Collapsed by default — the panel feels lighter
  // and "complete" sooner because the eye only has to scan kind + title
  // initially. Click a row's chevron (or any part of the row) to reveal the
  // action sentence. State resets whenever the term changes.
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  useEffect(() => {
    setExpanded({});
  }, [term]);

  const toggle = (i: number) => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className={`flex flex-col ${sectionGap} ${pad}`}>
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-meta font-meta text-ink-mut">TO MASTER</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-meta font-meta text-ink-mut hover:opacity-60 transition-opacity duration-hover focus-ring"
              aria-label="Close insight panel"
            >
              CLOSE
            </button>
          )}
        </div>
        <h2
          className="text-ink normal-case"
          style={{
            ...PROSE_STYLE,
            fontSize: '20px',
            lineHeight: 1.2,
            fontVariationSettings: '"wdth" 100, "wght" 600',
          }}
        >
          {term}
        </h2>
      </div>

      {loading && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <div className="h-3 w-3/4 animate-skeleton" />
          <div className="h-3 w-2/3 animate-skeleton" />
          <div className="h-3 w-1/2 animate-skeleton" />
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col gap-2">
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
            <p
              className={`${PROSE_CLASS}`}
              style={{ ...PROSE_STYLE, fontSize: '15px' }}
            >
              {insight.framing}
            </p>
          )}

          {insight.moves.length > 0 && (
            <ol className="flex flex-col gap-5">
              {insight.moves.map((m, i) => {
                const isExpanded = !!expanded[i];
                return (
                  <li key={i} className="flex gap-3">
                    <span
                      className="text-meta font-meta text-ink-mut shrink-0 pt-0.5"
                      aria-hidden
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => toggle(i)}
                        aria-expanded={isExpanded}
                        aria-controls={`move-${i}-action`}
                        className="flex items-baseline gap-2 flex-wrap text-left w-full hover:opacity-70 transition-opacity duration-hover focus-ring rounded-sm"
                      >
                        <span className="text-meta font-meta text-ink-mut shrink-0">
                          {KIND_LABEL[m.kind]}
                        </span>
                        <span
                          className={`${PROSE_CLASS} font-semibold flex-1`}
                          style={{
                            ...PROSE_STYLE,
                            fontSize: '15px',
                            fontVariationSettings: '"wdth" 100, "wght" 600',
                          }}
                        >
                          {m.title}
                        </span>
                        <span
                          className="text-meta font-meta text-ink-mut shrink-0 select-none"
                          aria-hidden
                          style={{ fontSize: '11px' }}
                        >
                          {isExpanded ? '▾' : '▸'}
                        </span>
                      </button>
                      {isExpanded && (
                        <p
                          id={`move-${i}-action`}
                          className={PROSE_CLASS}
                          style={{ ...PROSE_STYLE, fontSize: '14px' }}
                        >
                          {m.action}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
