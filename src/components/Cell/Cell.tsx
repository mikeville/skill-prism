import { type ReactNode, useMemo } from 'react';
import type { CellState, Tier } from '../../types';
import { Skeleton } from './Skeleton';
import { useTypeMode } from '../../contexts/TypeMode';
import { useFitText } from '../../hooks/useFitText';
import { splitLines, LINE_HEIGHT, type FitTier } from '../../lib/fitText';

type CellProps = {
  tier: Tier;
  state: CellState;
  content?: string;
  onClick?: () => void;
  children?: ReactNode;
  cellRef?: (el: HTMLDivElement | null) => void;
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
  primary: 'text-primary font-primary text-ink',
  secondary: 'text-secondary font-secondary text-ink',
  tertiary: 'text-tertiary font-tertiary text-ink-mut',
};

const compactSecondaryTypePlain = 'text-tertiary font-secondary text-ink';

// Display-mode color classes only (font-size + weight are owned by the fit hook).
const tierColorDisplay: Record<Tier, string> = {
  primary: 'text-ink',
  secondary: 'text-ink',
  tertiary: 'text-ink-mut',
};

function fitTierFor(tier: Tier, compact: boolean | undefined): FitTier {
  // Compact secondaries (center 3x3) use tertiary sizing in plain mode; mirror that here.
  if (tier === 'secondary' && compact) return 'tertiary';
  return tier;
}

export function Cell({ tier, state, content, onClick, children, cellRef, compact }: CellProps) {
  const { mode } = useTypeMode();
  const display = mode === 'display';
  const clickable = !!onClick && state === 'content';

  const lines = useMemo(() => (content ? splitLines(content) : []), [content]);
  const linesKey = lines.join('\n');

  const fitRef = useFitText<HTMLDivElement>({
    tier: fitTierFor(tier, compact),
    enabled: display && state === 'content' && lines.length > 0,
    deps: [linesKey, display],
  });

  const base =
    'relative flex items-center justify-center text-center overflow-hidden ' +
    'transition-colors duration-hover w-full h-full p-2';
  const hover = clickable ? 'cursor-pointer hover:bg-fill-page' : '';
  const fill = tierFill[tier];

  const type = display
    ? `font-display ${tierColorDisplay[tier]}`
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
        display ? (
          <div
            ref={fitRef}
            className="flex flex-col items-stretch justify-center w-full h-full uppercase"
          >
            {lines.map((line, i) => (
              <span
                key={i}
                className="block w-full whitespace-nowrap text-center"
                style={{
                  lineHeight: LINE_HEIGHT,
                  fontVariationSettings: '"wdth" 100, "wght" 600',
                }}
              >
                {line}
              </span>
            ))}
          </div>
        ) : (
          <span className="block w-full break-words hyphens-auto [text-wrap:balance]">
            {content}
          </span>
        )
      ) : null}
      {children}
    </div>
  );
}
