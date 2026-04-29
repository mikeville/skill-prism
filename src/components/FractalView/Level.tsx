import type { CellState, Tier } from '../../types';
import { Cell } from '../Cell/Cell';

export type FractalNode = {
  term: string;
  children?: FractalNode[];
};

export type CellClick =
  | { kind: 'secondary'; mainIdx: number }
  | { kind: 'tertiary'; mainIdx: number; subIdx: number };

export type CellRefKey = { mainIdx: number; subIdx?: number };

type LevelProps = {
  node: FractalNode;
  depth: 1 | 2;
  tier: 'primary' | 'secondary';
  loading: boolean;
  onCellClick: (c: CellClick) => void;
  registerCell?: (key: CellRefKey, el: HTMLDivElement | null) => void;
  trail?: { mainIdx: number };
};

const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function Level({ node, depth, tier, loading, onCellClick, registerCell, trail }: LevelProps) {
  const childTier: Tier = tier === 'primary' ? 'secondary' : 'tertiary';
  // depth=2 grid uses 8px tan gaps between blocks; depth=1 uses 2px between cells.
  const gap = depth === 2 ? 'gap-2' : 'gap-[2px]';

  return (
    <div className={`grid grid-cols-3 grid-rows-3 ${gap} w-full h-full bg-tan`}>
      {SLOTS.map((slot) => {
        const isCenter = slot === 4;

        if (isCenter) {
          if (depth === 2) {
            return (
              <Level
                key={slot}
                node={node}
                depth={1}
                tier={tier}
                loading={loading}
                onCellClick={onCellClick}
                registerCell={registerCell}
                trail={trail}
              />
            );
          }
          // depth=1, center: focal cell.
          return (
            <Cell
              key={slot}
              tier={tier}
              state={node.term ? 'content' : loading ? 'loading' : 'empty'}
              content={node.term}
            />
          );
        }

        // Surrounding slot. Map slot 0..3,5..8 → childIdx 0..7 (skip the center slot).
        const childIdx = slot < 4 ? slot : slot - 1;
        const child = node.children?.[childIdx];

        if (depth === 2) {
          // Each surrounding slot becomes a nested 3x3 with this child (a secondary) at center.
          // depth=2 only applies at the top level (tier='primary'), so childTier is always 'secondary' here.
          return (
            <Level
              key={slot}
              node={child ?? { term: '', children: undefined }}
              depth={1}
              tier="secondary"
              loading={loading}
              onCellClick={onCellClick}
              registerCell={registerCell}
              trail={{ mainIdx: childIdx }}
            />
          );
        }

        // depth=1, surrounding: leaf cell.
        const term = child?.term ?? '';
        const state: CellState = term ? 'content' : loading ? 'loading' : 'empty';

        const refKey: CellRefKey =
          trail != null
            ? { mainIdx: trail.mainIdx, subIdx: childIdx }
            : { mainIdx: childIdx };

        const click =
          trail != null
            ? () => onCellClick({ kind: 'tertiary', mainIdx: trail.mainIdx, subIdx: childIdx })
            : () => onCellClick({ kind: 'secondary', mainIdx: childIdx });

        return (
          <Cell
            key={slot}
            tier={childTier}
            state={state}
            content={term}
            onClick={state === 'content' ? click : undefined}
            cellRef={(el) => registerCell?.(refKey, el)}
          />
        );
      })}
    </div>
  );
}
