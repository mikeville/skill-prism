import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { CellState, Tier } from '../../types';
import { Skeleton } from './Skeleton';
import { useTypeMode } from '../../contexts/TypeMode';
import { useFitText } from '../../hooks/useFitText';
import { splitLines, type FitTier } from '../../lib/fitText';
import { ANYBODY } from '../../lib/fontConfig';

type CellProps = {
  tier: Tier;
  state: CellState;
  content?: string;
  onClick?: () => void;
  children?: ReactNode;
  // compact secondaries (the 8 in the center 3x3) keep the dark ink color but borrow tertiary's smaller type size.
  compact?: boolean;
};

// All tiers share the same paper fill — visual hierarchy is now carried
// entirely by type weight/width/size and the ink/ink-mut color split.
const tierFill: Record<Tier, string> = {
  primary: 'bg-paper',
  secondary: 'bg-paper',
  tertiary: 'bg-paper',
};

const tierTypePlain: Record<Tier, string> = {
  primary: 'text-plain-primary md:text-plain-primary-md text-ink',
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

export function Cell({ tier, state, content, onClick, children, compact }: CellProps) {
  const { mode } = useTypeMode();
  const font = ANYBODY;
  const poster = mode === 'poster';
  const clickable = !!onClick && state === 'content';

  // Track cell dimensions so splitLines can break long words contextually —
  // PERIODIZATION stays intact in a wide cell but breaks in a narrow one.
  const cellRef = useRef<HTMLDivElement | null>(null);
  const [cellSize, setCellSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    const el = cellRef.current;
    if (!el) return;
    const update = () => setCellSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lines = useMemo(
    () => (content ? splitLines(content, cellSize.w || undefined, cellSize.h || undefined) : []),
    [content, cellSize.w, cellSize.h],
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
  const base =
    `relative flex items-center justify-center text-center overflow-hidden ` +
    `transition-colors duration-hover w-full h-full ${padding}`;
  const hover = clickable ? 'cursor-pointer hover:bg-fill-page' : '';
  const fill = tierFill[tier];

  const type = poster
    ? compact && tier === 'secondary'
      ? 'text-ink-mut'
      : tierColorPoster[tier]
    : compact && tier === 'secondary'
      ? compactSecondaryTypePlain
      : tierTypePlain[tier];

  return (
    <div
      ref={cellRef}
      onClick={clickable ? onClick : undefined}
      className={`${base} ${fill} ${type} ${hover}`.trim()}
    >
      {state === 'loading' ? (
        <Skeleton />
      ) : state === 'empty' ? (
        <span className="text-ink-faint">—</span>
      ) : content ? (
        poster ? (
          <div
            ref={fitRef}
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
