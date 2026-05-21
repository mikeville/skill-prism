import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CellState, Tier } from '../../types';
import { Skeleton } from './Skeleton';
import { useTypeMode } from '../../contexts/TypeMode';
import { useFitText } from '../../hooks/useFitText';
import {
  getPlainTypeSettings,
  measurePlainTextWidth,
  splitLines,
  type FitTier,
  type PlainTypeSettings,
} from '../../lib/fitText';
import { ANYBODY } from '../../lib/fontConfig';

type CellProps = {
  tier: Tier;
  state: CellState;
  content?: string;
  onClick?: () => void;
  children?: ReactNode;
  // compact secondaries (the 8 in the center 3x3) keep the dark ink color but borrow tertiary's smaller type size.
  compact?: boolean;
  // Number of "small-cell tiles" this cell spans across the grid. Defaults
  // to 1 for the tertiary/secondary cells (one 1fr slot). The depth=2
  // primary cell occupies the entire center macro-block, which is 3 small
  // tiles across, so it passes cellSpan=3. Plain-mode type settings divide
  // cellSize by this so the primary uses the same uniform fontSize/wdth as
  // every other cell instead of its own oversized self-measurement.
  cellSpan?: number;
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

// Tier color is the only visual hierarchy carried by typography itself —
// fontSize/wdth/wght are owned by the mode-specific logic (fit hook in
// poster, getPlainTypeSettings in plain). The same color map serves both
// modes; size/scale stand-out is provided by the surrounding outer block
// highlight (and breadcrumb), not by the type.
const tierColor: Record<Tier, string> = {
  primary: 'text-ink',
  secondary: 'text-ink',
  tertiary: 'text-ink-mut',
};

// Plain-mode line-height. Poster mode uses the font's tight 0.8 (lines hug
// each other so multi-line text fills the cell vertically). Plain mode
// doesn't fill — it has comfy padding around the text — so it can afford
// more generous leading. Used both in the rendered <span> lineHeight and in
// the PrimaryArrows textH calculation so the ellipse height matches.
const PLAIN_LINE_HEIGHT = 1.1;

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
function PrimaryArrows({
  lines,
  plainSettings,
  hasInsightIcon,
}: {
  lines: string[];
  plainSettings: PlainTypeSettings;
  // When true, the cell renders a 14×14 insight "i" affordance anchored at
  // bottom-right; arrows inset further from the cell edges to avoid
  // colliding with it. Mobile passes false (no insight icon there).
  hasInsightIcon: boolean;
}) {
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
  const { fontSize: plainFontSize, wdth: plainWdth } = plainSettings;

  // Text bounding box in cell-px space. Width = widest line; height = lines
  // stacked at the rendered line-height (PLAIN_LINE_HEIGHT, not the font's
  // tight 0.8 — plain mode uses comfy leading). measurePlainTextWidth
  // probes the font at the active axes so widths match what's drawn.
  let textW = 0;
  let textH = 0;
  if (plainFontSize > 0) {
    for (const line of lines) {
      const lw = measurePlainTextWidth(line, plainFontSize, plainWdth);
      if (lw > textW) textW = lw;
    }
    textH = lines.length * plainFontSize * PLAIN_LINE_HEIGHT;
  }

  const cx = w / 2;
  const cy = h / 2;
  // Cell-edge inset for the arrowhead tip. When the cell renders the 14×14
  // insight "i" affordance at bottom-right (desktop), all 8 arrows inset to
  // 18px so the bottom-right diagonal clears the icon — symmetry across all
  // arrows is preferable to asymmetric per-corner insets. On mobile no icon
  // is rendered, so we use the original tight 6px inset for visual reach.
  const m = hasInsightIcon ? 18 : 6;
  // Base pad scales with both text size and cell size so the gap stays
  // visually consistent whether the cell is tiny (sub-200px) or huge (export
  // render). Used as the unit for the three direction-specific pads below.
  const pad = Math.max(8, plainFontSize * 0.8, Math.min(w, h) * 0.03);

  // ── Tune arrow-to-text distance, per direction ─────────────────────────
  // Each pad is an extra gap added to the text's half-extent in that axis.
  // Larger value → arrow tail further from text (shorter arrow). The three
  // are independent: editing one doesn't affect the others.
  const horizontalPad = pad;       // ← controls left/right arrow tail X
  const verticalPad = pad * 1.2;   // ← controls up/down arrow tail Y
  const diagonalPad = pad * 0.9;         // ← controls the four corner arrows
  // ───────────────────────────────────────────────────────────────────────

  const maxRx = Math.max(0, w / 2 - m - 8);
  const maxRy = Math.max(0, h / 2 - m - 8);

  // Cardinal exit points (where the four straight arrow tails sit).
  const horizontalExit = Math.min(textW / 2 + horizontalPad, maxRx);
  const verticalExit = Math.min(textH / 2 + verticalPad, maxRy);

  // Diagonal exclusion rect (parametric ray-vs-edge clip for the four
  // corner arrows). Sized by diagonalPad on both axes so editing it shifts
  // all four diagonals together without touching the cardinals.
  const diagRx = Math.min(textW / 2 + diagonalPad, maxRx);
  const diagRy = Math.min(textH / 2 + diagonalPad, maxRy);

  // Outer endpoints: cardinal arrows hit the mid-edge, diagonals hit the
  // corner.
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
    if (dx === 0 && dy === 0) return { x1: cx, y1: cy, x2: ox, y2: oy };
    // Vertical arrow (up/down) — tail sits verticalExit below/above center.
    if (dx === 0) {
      return { x1: cx, y1: cy + Math.sign(dy) * verticalExit, x2: ox, y2: oy };
    }
    // Horizontal arrow (left/right) — tail sits horizontalExit aside center.
    if (dy === 0) {
      return { x1: cx + Math.sign(dx) * horizontalExit, y1: cy, x2: ox, y2: oy };
    }
    // Diagonal — exit on the rect bbox edge: the line first hits
    // |dx|=diagRx OR |dy|=diagRy whichever has the smaller t.
    const tx = diagRx <= 0 ? Infinity : diagRx / Math.abs(dx);
    const ty = diagRy <= 0 ? Infinity : diagRy / Math.abs(dy);
    const t = Math.min(tx, ty);
    const safeT = Number.isFinite(t) ? t : 0;
    return {
      x1: cx + dx * safeT,
      y1: cy + dy * safeT,
      x2: ox,
      y2: oy,
    };
  });

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none" aria-hidden>
      {w > 0 && h > 0 && diagRx > 0 && diagRy > 0 && (
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
  cellSpan = 1,
  domRef,
  onInsightClick,
}: CellProps) {
  const { mode } = useTypeMode();
  const font = ANYBODY;
  const poster = mode === 'poster';
  const clickable = !!onClick && state === 'content';

  // Track cell dimensions so splitLines can break long words contextually —
  // PERIODIZATION stays intact in a wide cell but breaks in a narrow one. We
  // keep both outer (clientWidth) and inner (clientWidth − padding) so plain
  // settings can normalize the depth=2 primary's wide outer extent down to
  // an equivalent small-cell inner width.
  const cellRef = useRef<HTMLDivElement | null>(null);
  const [cellSize, setCellSize] = useState<{
    outerW: number;
    innerW: number;
    innerH: number;
    padX: number;
  }>({ outerW: 0, innerW: 0, innerH: 0, padX: 0 });
  useEffect(() => {
    const el = cellRef.current;
    if (!el) return;
    const update = () => {
      const cs = window.getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const outerW = el.clientWidth;
      setCellSize({
        outerW,
        innerW: outerW - padX,
        innerH: el.clientHeight - padY,
        padX,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Plain-mode type settings derived from the canonical small-cell inner
  // width. For tertiary/secondary cells (cellSpan=1) this is just innerW.
  // For the depth=2 primary (cellSpan=3) we divide outerW by 3 to get the
  // equivalent small-cell outer width, then subtract the same padding to
  // get the inner equivalent — keeps every plain cell at the same
  // fontSize/wdth instead of letting the primary self-measure its 3x extent.
  const canonicalCellW = useMemo(() => {
    if (cellSize.outerW <= 0) return 0;
    if (cellSpan === 1) return cellSize.innerW;
    return cellSize.outerW / cellSpan - cellSize.padX;
  }, [cellSize.outerW, cellSize.innerW, cellSize.padX, cellSpan]);

  const plainSettings = useMemo(
    () => getPlainTypeSettings(canonicalCellW || undefined),
    [canonicalCellW],
  );

  const lines = useMemo(
    () =>
      content
        ? splitLines(content, cellSize.innerW || undefined, cellSize.innerH || undefined, {
            mode: poster ? 'poster' : 'plain',
            plainFontSize: plainSettings.fontSize,
            plainWdth: plainSettings.wdth,
          })
        : [],
    [
      content,
      cellSize.innerW,
      cellSize.innerH,
      poster,
      plainSettings.fontSize,
      plainSettings.wdth,
    ],
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

  // Compact center-3x3 secondaries borrow tertiary's muted ink color in both
  // modes; everything else follows the tier's default color.
  const type = compact && tier === 'secondary' ? 'text-ink-mut' : tierColor[tier];

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
        <PrimaryArrows
          lines={lines}
          plainSettings={plainSettings}
          hasInsightIcon={!!onInsightClick}
        />
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
          // Cell-hover affordance: identical SVG to the topbar's sidebar
          // toggle (same 14×14 viewBox, same strokeWidth, same filled-right
          // form) so the two read as the same icon family. Reveals on cell
          // hover only; ink-mut by default, ink on icon-hover so the cell's
          // group-hover doesn't pre-darken it.
          className="absolute bottom-0 right-0 inline-flex text-line-meta hover:text-ink opacity-0 group-hover:opacity-100 transition-opacity duration-hover focus-ring leading-none z-10"
        >
          {/* The 14×14 viewBox the topbar uses has ~2px of empty space below
              the rect (rect runs y=2→12). Translating the SVG down by 2px
              lets the cell's overflow-hidden clip that empty band so the
              visible rect sits flush with the cell's bottom edge while still
              matching the topbar icon's exact size and proportions. */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            aria-hidden
            className="block translate-y-[2px]"
          >
            <rect x="0.5" y="2" width="13" height="10" />
            <rect x="9" y="2" width="5" height="10" fill="currentColor" stroke="none" />
          </svg>
        </button>
      )}
      {state === 'loading' ? (
        <Skeleton />
      ) : state === 'empty' ? (
        <span className="text-ink-faint">—</span>
      ) : content ? (
        // Both modes share the same line-stack structure. Poster mode owns
        // fontSize + font-variation via the fit hook (controlled per cell).
        // Plain mode reads uniform settings from getPlainTypeSettings so
        // every plain cell renders at the same fontSize/wdth/wght. fitRef
        // is attached in both modes so useFitText's clearFit fires reliably
        // on plain→poster toggles.
        <div
          ref={fitRef}
          data-fit-target
          data-fit-tier={fitTierFor(tier, compact)}
          data-fit-mode={poster ? 'poster' : 'plain'}
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
            const lineStyle: CSSProperties = poster
              ? {
                  lineHeight: font.lineHeight,
                  fontVariationSettings: `"wdth" ${font.cellStaticDisplay.wdth}, "wght" ${font.cellStaticDisplay.wght}`,
                  textBoxTrim: trim,
                  textBoxEdge: 'cap alphabetic',
                }
              : {
                  fontSize: `${plainSettings.fontSize}px`,
                  lineHeight: PLAIN_LINE_HEIGHT,
                  fontVariationSettings: `"wdth" ${plainSettings.wdth}, "wght" ${plainSettings.wght}`,
                  textBoxTrim: trim,
                  textBoxEdge: 'cap alphabetic',
                };
            return (
              <span
                key={i}
                className="block w-full whitespace-nowrap text-center"
                style={lineStyle}
              >
                {line}
              </span>
            );
          })}
        </div>
      ) : null}
      {children}
    </div>
  );
}
