import { type ReactNode } from 'react';
import type { CellState, Tier } from '../../types';
import { Skeleton } from './Skeleton';

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

const tierFill: Record<Tier, string> = {
  primary: 'bg-paper',
  secondary: 'bg-fill-secondary',
  tertiary: 'bg-fill-tertiary',
};

const tierType: Record<Tier, string> = {
  primary: 'text-primary font-primary text-ink',
  secondary: 'text-secondary font-secondary text-ink',
  tertiary: 'text-tertiary font-tertiary text-ink-mut',
};

const compactSecondaryType = 'text-tertiary font-secondary text-ink';

export function Cell({ tier, state, content, onClick, children, cellRef, compact }: CellProps) {
  const clickable = !!onClick && state === 'content';

  const base =
    'relative flex items-center justify-center text-center overflow-hidden ' +
    'transition-colors duration-hover w-full h-full p-2';
  const hover = clickable ? 'cursor-pointer hover:bg-fill-page' : '';
  const fill = tierFill[tier];
  const type = compact && tier === 'secondary' ? compactSecondaryType : tierType[tier];

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
        <span className="block w-full break-words hyphens-auto [text-wrap:balance]">
          {content}
        </span>
      ) : null}
      {children}
    </div>
  );
}
