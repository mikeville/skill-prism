import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CellState, Tier } from '../../types';
import { Skeleton } from './Skeleton';
import { useTypeMode } from '../../contexts/TypeMode';
import { useFitText } from '../../hooks/useFitText';
import { measurePlainTextWidth, splitLines, type FitTier } from '../../lib/fitText';
import { ANYBODY } from '../../lib/fontConfig';

type CellProps = {
  tier: Tier;
  state: CellState;
  content?: string;
  onClick?: () => void;
  children?: ReactNode;
  // compact secondaries (the 8 in the center 3x3) keep the dark ink color but borrow tertiary's smaller type size.
  compact?: boolean;
  // Callback ref attached to the cell's outer div. App.tsx uses this to grab
  // the primary cell node for the empty→active morph (FLIP from input rect).
  domRef?: (el: HTMLDivElement | null) => void;
  // Optional "now what?" hover affordance — small icon in the top-right that
  // opens the insight drawer for this cell's term. Only shown when the cell
  // has content. Hidden on mobile (md: gated) since mobile uses the bottom
  // panel locked to the focal term instead.
  onInsightClick?: () => void;
};

// All tiers share the same paper fill — visual hierarchy is now carried
// entirely by type weight/width/size and the ink/ink-mut color split.
const tierFill: Record<Tier, string> = {
  primary: 'bg-paper',
  secondary: 'bg-paper',
  tertiary: 'bg-paper',
};

// Plain-mode primary uses the same type size as every other cell. The focal
// cell stands out via highlight colour on the surrounding outer block (and
// breadcrumb context), not via scale — this dodges the long-word overflow
// that a larger primary size produced at mobile widths.
const tierTypePlain: Record<Tier, string> = {
  primary: 'text-plain-other md:text-plain-other-md text-ink',
  secondary: 'text-plain-other md:text-plain-other-md text-ink',
  tertiary: 'text-plain-other md:text-plain-other-md text-ink-mut',
};

const compactSecondaryTypePlain = 'text-plain-other md:text-plain-other-md text-ink-mut';

// Poster-mode color classes only — fontFamily is set inline from the active
// typeface, and font-size + weight are owned by the fit hook.
const tierColorPoster: Record<Tier, string> = {
  primary: 'text-ink',
  secondary: 'text-ink',
  tertiary: 'text-ink-mut',
};

function fitTierFor(tier: Tier, compact: boolean | undefined): FitTier {
  // Compact secondaries (center 3x3) use tertiary sizing in plain mode; mirror that here.
  if (tier === 'secondary' && compact) return 'tertiary';
  return tier;
}

// 8-arrow overlay rendered inside the plain-mode primary cell. Arrows radiate
// from an exclusion *ellipse* shaped to the rendered text, outward to the 8
// surrounding cells. Plain-mode-only.
//
// Why an ellipse (not a circle) for the exclusion zone: text is much wider
// than tall, so a circle inscribing the text gave vertical arrows a huge gap
// while horizontals/diagonals were tight. An ellipse with semi-axes matched
// to the text's actual width/height yields a roughly uniform pad in every
// direction. Stroke-linecap="butt" still gives each line a flat cap that's
// perpendicular to the LINE itself (independent of the start curve), so the
// inner termination reads as a clean right-angle cut.
//
// Pixel-coordinate SVG (not a percentage viewBox) so the arrowheads keep
// their proportions and angles in any cell aspect.
function PrimaryArrows({ lines, plainFontSize }: { lines: string[]; plainFontSize: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;

  // Text bounding box in cell-px space. Width = widest line; height = lines
  // stacked at the rendered line-height. measurePlainTextWidth probes the
  // active font at the plain-mode axes so the result matches what's drawn.
  let textW = 0;
  let textH = 0;
  if (plainFontSize > 0) {
    for (const line of lines) {
      const lw = measurePlainTextWidth(line, plainFontSize);
      if (lw > textW) textW = lw;
    }
    textH = lines.length * plainFontSize * ANYBODY.lineHeight;
  }

  // Ellipse semi-axes: half-text-extent + a small breathing pad on each axis.
  // Same pad horizontally and vertically, so the cardinal cap-to-glyph gap is
  // identical up/down/left/right. Clamped so the ellipse never grows past the
  // cell — keeps arrows visible even in tiny cells.
  const cx = w / 2;
  const cy = h / 2;
  const m = 6; // cell-edge inset for the arrowhead tip
  const pad = Math.max(6, plainFontSize * 0.6);
  const maxAx = Math.max(0, w / 2 - m - 8);
  const maxAy = Math.max(0, h / 2 - m - 8);
  const ax = Math.min(textW / 2 + pad, maxAx);
  const ay = Math.min(textH / 2 + pad, maxAy);

  // Outer endpoints: cardinal arrows hit the mid-edge, diagonals hit the
  // corner. Each arrow's start is the intersection of the ellipse with the
  // ray from the cell centre toward its outer endpoint, found via the
  // standard parametric ellipse-line intersection: t = 1/√((dx/ax)²+(dy/ay)²).
  const outer: Array<[number, number]> = [
    [cx, m],          // up
    [cx, h - m],      // down
    [m, cy],          // left
    [w - m, cy],      // right
    [m, m],           // up-left
    [w - m, m],       // up-right
    [m, h - m],       // down-left
    [w - m, h - m],   // down-right
  ];

  const arrows = outer.map(([ox, oy]) => {
    const dx = ox - cx;
    const dy = oy - cy;
    const t = ax > 0 && ay > 0
      ? 1 / Math.hypot(dx / ax, dy / ay)
      : 0;
    return {
      x1: cx + dx * t,
      y1: cy + dy * t,
      x2: ox,
      y2: oy,
    };
  });

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none" aria-hidden>
      {w > 0 && h > 0 && ax > 0 && ay > 0 && (
        <svg width={w} height={h} className="block" data-primary-arrows>
          <defs>
            <marker
              id="primary-arrowhead"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
            </marker>
          </defs>
          {arrows.map((a, i) => (
            <line
              key={i}
              x1={a.x1}
              y1={a.y1}
              x2={a.x2}
              y2={a.y2}
              stroke="currentColor"
              strokeWidth={1.25}
              strokeLinecap="butt"
              markerEnd="url(#primary-arrowhead)"
            />
          ))}
        </svg>
      )}
    </div>
  );
}

export function Cell({
  tier,
  state,
  content,
  onClick,
  children,
  compact,
  domRef,
  onInsightClick,
}: CellProps) {
  const { mode } = useTypeMode();
  const font = ANYBODY;
  const poster = mode === 'poster';
  const clickable = !!onClick && state === 'content';

  // Track cell dimensions so splitLines can break long words contextually —
  // PERIODIZATION stays intact in a wide cell but breaks in a narrow one.
  // Also track the resolved plain-mode font size: it comes from clamp()-based
  // Tailwind classes, so we read getComputedStyle to know the actual px value
  // splitLines should compare token widths against in plain mode. We subtract
  // padding from the dimensions so cellSize represents the actual text area
  // (matches fitMultiline's convention for poster-mode width measurement).
  const cellRef = useRef<HTMLDivElement | null>(null);
  const [cellSize, setCellSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [plainFontSize, setPlainFontSize] = useState<number>(0);
  useEffect(() => {
    const el = cellRef.current;
    if (!el) return;
    const update = () => {
      const cs = window.getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      setCellSize({ w: el.clientWidth - padX, h: el.clientHeight - padY });
      const fs = parseFloat(cs.fontSize);
      if (!Number.isNaN(fs)) setPlainFontSize(fs);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lines = useMemo(
    () =>
      content
        ? splitLines(content, cellSize.w || undefined, cellSize.h || undefined, {
            mode: poster ? 'poster' : 'plain',
            plainFontSize: plainFontSize || undefined,
          })
        : [],
    [content, cellSize.w, cellSize.h, poster, plainFontSize],
  );
  const linesKey = lines.join('\n');

  const fitRef = useFitText<HTMLDivElement>({
    tier: fitTierFor(tier, compact),
    enabled: poster && state === 'content' && lines.length > 0,
    deps: [linesKey, poster],
  });

  // 1rem padding (≈16px) inside every cell. The fit algorithm reads container
  // padding via getComputedStyle, so poster-mode text still sizes to fill the
  // inner area; tracking pushes the first/last char flush with the inner edge
  // rather than the cell border.
  const padding = 'p-4';
  // `group` lets the insight "i" affordance use group-hover to reveal on cell hover.
  const base =
    `group relative flex items-center justify-center text-center overflow-hidden ` +
    `transition-colors duration-hover w-full h-full ${padding}`;
  // Clickable cells get the shared cell interaction vocabulary: subtle
  // ink-tinted hover bg + inset focus ring. Primary stays opt-out via the
  // clickable gate (no onClick → no hover, focus, or keyboard handler).
  const hover = clickable ? 'cursor-pointer hover-bg-cell focus-ring-inset' : '';
  const fill = tierFill[tier];

  const onKeyDown = clickable
    ? (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }
    : undefined;

  const type = poster
    ? compact && tier === 'secondary'
      ? 'text-ink-mut'
      : tierColorPoster[tier]
    : compact && tier === 'secondary'
      ? compactSecondaryTypePlain
      : tierTypePlain[tier];

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      cellRef.current = el;
      domRef?.(el);
    },
    [domRef],
  );

  return (
    <div
      ref={setRef}
      onClick={clickable ? onClick : undefined}
      onKeyDown={onKeyDown}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      className={`${base} ${fill} ${type} ${hover}`.trim()}
    >
      {!poster && tier === 'primary' && state === 'content' && (
        <PrimaryArrows lines={lines} plainFontSize={plainFontSize} />
      )}
      {onInsightClick && state === 'content' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInsightClick();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={content ? `Get insight on ${content}` : 'Get insight'}
          className="flex absolute top-1.5 right-1.5 w-5 h-5 items-center justify-center text-meta font-meta text-ink-mut bg-paper border border-line-meta opacity-0 group-hover:opacity-100 transition-opacity duration-hover hover:text-ink hover:border-ink focus-ring z-10"
        >
          i
        </button>
      )}
      {state === 'loading' ? (
        <Skeleton />
      ) : state === 'empty' ? (
        <span className="text-ink-faint">—</span>
      ) : content ? (
        poster ? (
          <div
            ref={fitRef}
            data-fit-target
            data-fit-tier={fitTierFor(tier, compact)}
            className="flex flex-col items-stretch justify-center w-full h-full uppercase"
            style={{ fontFamily: font.family }}
          >
            {lines.map((line, i) => {
              // Trim the cap/baseline-to-line-box gap on the first and last
              // visible lines only, so the stack hugs the cell flush at top
              // and bottom for vertical centering — but inner lines keep their
              // natural lineHeight 0.8 leading so adjacent lines don't touch.
              const isFirst = i === 0;
              const isLast = i === lines.length - 1;
              const trim =
                isFirst && isLast
                  ? 'trim-both'
                  : isFirst
                    ? 'trim-start'
                    : isLast
                      ? 'trim-end'
                      : 'none';
              return (
                <span
                  key={i}
                  className="block w-full whitespace-nowrap text-center"
                  style={{
                    lineHeight: font.lineHeight,
                    fontVariationSettings: `"wdth" ${font.cellStaticDisplay.wdth}, "wght" ${font.cellStaticDisplay.wght}`,
                    textBoxTrim: trim,
                    textBoxEdge: 'cap alphabetic',
                  }}
                >
                  {line}
                </span>
              );
            })}
          </div>
        ) : (
          // Plain mode shares splitLines with poster mode so long words get
          // TeX-syllable-hyphenated rather than character-broken. Each line is
          // rendered as its own block; hyphens-auto is the CSS fallback when
          // an individual line still doesn't fit at the static size. fitRef
          // stays attached on this branch too so useFitText's clearFit fires
          // reliably on poster→plain toggle.
          <div
            ref={fitRef}
            data-fit-target
            data-fit-tier={fitTierFor(tier, compact)}
            data-fit-mode="plain"
            className="flex flex-col items-stretch justify-center w-full h-full uppercase"
          >
            {lines.map((line, i) => {
              const isFirst = i === 0;
              const isLast = i === lines.length - 1;
              const trim =
                isFirst && isLast
                  ? 'trim-both'
                  : isFirst
                    ? 'trim-start'
                    : isLast
                      ? 'trim-end'
                      : 'none';
              return (
                <span
                  key={i}
                  lang="en"
                  className="block w-full text-center hyphens-auto"
                  style={{
                    fontVariationSettings: '"wdth" 100, "wght" 500',
                    textBoxTrim: trim,
                    textBoxEdge: 'cap alphabetic',
                  }}
                >
                  {line}
                </span>
              );
            })}
          </div>
        )
      ) : null}
      {children}
    </div>
  );
}
