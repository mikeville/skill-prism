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
};

const tierFill: Record<Tier, string> = {
  primary: 'bg-gold-primary',
  secondary: 'bg-gold-secondary',
  tertiary: 'bg-paper',
};

const tierType: Record<Tier, string> = {
  primary: 'text-primary md:text-primary-d font-primary',
  secondary: 'text-secondary md:text-secondary-d font-secondary',
  tertiary: 'text-tertiary md:text-tertiary-d font-tertiary',
};

export function Cell({ tier, state, content, onClick, children, cellRef }: CellProps) {
  const clickable = !!onClick && state === 'content';

  const base =
    'relative flex items-center justify-center text-center text-ink overflow-hidden ' +
    'transition-colors duration-hover w-full h-full p-2';
  const hover = clickable ? 'cursor-pointer hover:bg-ink/5' : '';
  const fill = tierFill[tier];
  const type = tierType[tier];

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
