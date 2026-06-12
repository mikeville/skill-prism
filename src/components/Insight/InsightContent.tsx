import { useEffect, useState } from 'react';
import type { Insight, ResourceKind } from '../../lib/insightApi';

type Props = {
  term: string;
  insight: Insight | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  // Desktop only: dismiss handler. Renders an X icon next to the header so
  // the user always has a clear way to collapse the panel from inside it.
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

// Resolves the target URL for a move's title link. Books always land on a
// Goodreads search (no model-supplied URL needed); other kinds use the
// model's url field when it's a real http(s) URL.
function resolveMoveUrl(move: {
  kind: ResourceKind;
  title: string;
  url?: string;
}): string | null {
  if (move.kind === 'book') {
    // Strip "by Author Name" suffix to keep the search clean.
    const cleanTitle = move.title.replace(/\s+by\s+.+$/i, '').trim() || move.title;
    return `https://www.goodreads.com/search?q=${encodeURIComponent(cleanTitle)}`;
  }
  if (move.url && /^https?:\/\//i.test(move.url)) return move.url;
  return null;
}

// Direct Wikipedia URL from a model-supplied article title. The model is
// responsible for deciding the right interpretation in context (e.g.,
// "Personal finance" instead of the album "Make Money") and for returning
// null when no article fits (e.g., "eat messy foods on a date"). The UI
// only builds a URL when title is non-empty.
function wikipediaUrl(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return 'https://en.wikipedia.org/';
  const slug = trimmed.replace(/\s+/g, '_');
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`;
}

// Icon style guide (matches src/components/Export/ExportButton.tsx):
// - viewBox 14×14, no fill, stroke="currentColor", strokeWidth 1.2.
// - All angles 90° or 45° only.
// - Same visual weight across icons; line endings default (rounded looks
//   inconsistent at this size).

// One chevron shape (pointing right), rotated 90° clockwise when expanded.
// Using rotation rather than swapping shapes lets us animate the twirl
// smoothly via CSS transition.
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden
      style={{
        transform: `rotate(${expanded ? 90 : 0}deg)`,
        transformOrigin: '50% 50%',
        transition: 'transform 180ms ease-out',
      }}
    >
      {/* Right-pointing carrot, apex at (9.5, 7), legs at 45° from vertical */}
      <path d="M5.5 3 L9.5 7 L5.5 11" />
    </svg>
  );
}

// Just an arrow pointing up-right — no box. Matches the export icon's
// stroke width. Right-angle arrowhead (the two head strokes meet at 90°).
// Shaft and head sized to feel comparable to the chevron/close icons
// (the previous longer diagonal read as visually larger).
function ExternalLinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden
    >
      {/* Diagonal shaft at 45° — shortened from (3,11)→(11,3) */}
      <path d="M4 10 L10 4" />
      {/* Arrowhead — perpendicular L at tip (10, 4), 90° corner */}
      <path d="M5 4 H10 V9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden
    >
      <path d="M3 3 L11 11" />
      <path d="M11 3 L3 11" />
    </svg>
  );
}

// Variable-font weight for body prose. Tailwind has no utility for
// font-variation-settings, so this is the only way to drive Inter's wght
// axis below the global body default (450). Font SIZE and LINE-HEIGHT are
// owned by Tailwind's `text-body` token — apply it on the element's
// className, never set them inline here.
const PROSE_STYLE: React.CSSProperties = {
  fontVariationSettings: '"wght" 400',
};

const PROSE_CLASS = 'normal-case text-ink';

// Streaming sometimes lands a partial insight (framing + 1–2 moves) before the
// final JSON parse fails. When that happens we'd rather show the partial than
// the bare "COULDN'T LOAD" screen — the partial is usually the *useful* part,
// and a small inline retry below covers the gap.
function hasInsightContent(insight: Insight | null): boolean {
  if (!insight) return false;
  if (insight.framing && insight.framing.trim().length > 0) return true;
  return insight.moves.length > 0;
}

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
  // initially. Click anywhere on the row (except the external-link icon) to
  // reveal the action sentence. State resets whenever the term changes.
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  useEffect(() => {
    setExpanded({});
  }, [term]);

  const toggle = (i: number) => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className={`flex flex-col ${sectionGap} ${pad}`}>
      <div className="flex items-center justify-between gap-3">
        <h2
          className="text-ink normal-case first-letter:uppercase min-w-0 text-display"
          style={{
            fontVariationSettings: '"wght" 600',
          }}
        >
          {term}
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-ink-mut hover:opacity-60 transition-opacity duration-hover focus-ring rounded-sm p-1 -m-1 flex items-center justify-center shrink-0"
            aria-label="Close insight panel"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {loading && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <div className="h-3 w-3/4 animate-skeleton" />
          <div className="h-3 w-2/3 animate-skeleton" />
          <div className="h-3 w-1/2 animate-skeleton" />
        </div>
      )}

      {/* Full error fallback fires only when we have *no* parseable content.
          A streamed partial with framing or any move falls through to the
          render branch below; the retry surfaces as a small WIKI-row sibling. */}
      {error && !loading && !hasInsightContent(insight) && (
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

      {insight && !loading && (!error || hasInsightContent(insight)) && (
        <>
          {insight.framing && (
            <p
              className={`${PROSE_CLASS} text-body`}
              style={PROSE_STYLE}
            >
              {insight.framing}
            </p>
          )}

          {insight.moves.length > 0 && (
            <ol className="flex flex-col gap-5">
              {insight.moves.map((m, i) => {
                const isExpanded = !!expanded[i];
                const url = resolveMoveUrl(m);
                const titleStyle: React.CSSProperties = {
                  fontVariationSettings: '"wght" 600',
                };
                return (
                  <li key={i} className="flex items-baseline gap-2">
                    {/* Toggle button uses a 3-column grid: chevron | kind |
                        title. The expanded action paragraph drops to row 2
                        col 3 so it aligns under the title (not the chevron).
                        Kind column has a fixed width so titles line up
                        vertically across rows regardless of kind length. */}
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      aria-expanded={isExpanded}
                      aria-controls={`move-${i}-action`}
                      className="grid gap-x-1 items-baseline text-left flex-1 hover:opacity-70 transition-opacity duration-hover focus-ring rounded-sm min-w-0"
                      style={{ gridTemplateColumns: 'auto 3rem 1fr' }}
                    >
                      <span
                        className="text-ink-mut shrink-0 inline-flex items-center justify-center"
                        aria-hidden
                        style={{ transform: 'translateY(3px)' }}
                      >
                        <ChevronIcon expanded={isExpanded} />
                      </span>
                      {/* Kind label is right-aligned within its fixed-width
                          column so the gap between label end and title start
                          is consistent (~4px) regardless of label length —
                          BOOK, PERSON, SITE all end at the same x. */}
                      <span className="text-meta font-meta text-ink-mut shrink-0">
                        {KIND_LABEL[m.kind]}
                      </span>
                      <span className={`${PROSE_CLASS} min-w-0 text-body`} style={titleStyle}>
                        {m.title}
                      </span>
                      {isExpanded && (
                        <p
                          id={`move-${i}-action`}
                          className={`${PROSE_CLASS} mt-1 text-body`}
                          style={{
                            ...PROSE_STYLE,
                            gridColumnStart: 3,
                          }}
                        >
                          {m.action || <span className="opacity-50">…</span>}
                        </p>
                      )}
                    </button>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${m.title} in new tab`}
                        className="text-ink-mut hover:opacity-60 transition-opacity duration-hover focus-ring rounded-sm shrink-0 p-1 -m-1 inline-flex items-center justify-center"
                        style={{ transform: 'translateY(2px)' }}
                      >
                        <ExternalLinkIcon />
                      </a>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          <div className="flex items-center gap-4 mt-2">
            {insight?.wikipediaTitle && (
              <a
                href={wikipediaUrl(insight.wikipediaTitle)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-meta font-meta text-ink-mut hover:opacity-60 transition-opacity duration-hover focus-ring self-start inline-flex items-center gap-0"
              >
                WIKI
                <span
                  className="inline-flex"
                  style={{ transform: 'translateY(-1px)' }}
                >
                  <ExternalLinkIcon />
                </span>
              </a>
            )}
            {error && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-meta font-meta text-ink-mut hover:opacity-60 transition-opacity duration-hover focus-ring self-start"
                aria-label="Retry insight load"
              >
                RETRY
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
