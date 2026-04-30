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
  // standalone=true → this depth=1 grid renders its own dark frame (mobile single-grid).
  // standalone=false → it sits inside a depth=2 outer wrapper that already paints the dark gaps + frame.
  standalone?: boolean;
};

const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function Level({
  node,
  depth,
  tier,
  loading,
  onCellClick,
  registerCell,
  trail,
  standalone = true,
}: LevelProps) {
  if (depth === 2) {
    // Outer 3x3. The 2px gap + 2px padding on bg-ink paints the dark group dividers and outer frame.
    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-[2px] p-[2px] w-full h-full bg-ink">
        {SLOTS.map((slot) => {
          const isCenter = slot === 4;
          if (isCenter) {
            // Center block: topic (primary) at center, secondaries (mains) around it.
            return (
              <Level
                key={slot}
                node={node}
                depth={1}
                tier={tier}
                loading={loading}
                onCellClick={onCellClick}
                registerCell={registerCell}
                standalone={false}
              />
            );
          }
          // Surrounding block: a secondary at center, its tertiaries around.
          const childIdx = slot < 4 ? slot : slot - 1;
          const child = node.children?.[childIdx];
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
              standalone={false}
            />
          );
        })}
      </div>
    );
  }

  // depth === 1: a 3x3 block. The bg-line + gap-px paint the internal 1px hairlines.
  // standalone=true adds its own 2px ink frame; standalone=false relies on the outer wrapper.
  const wrapperClasses = standalone
    ? 'grid grid-cols-3 grid-rows-3 gap-px w-full h-full bg-line border-block border-ink box-border'
    : 'grid grid-cols-3 grid-rows-3 gap-px w-full h-full bg-line';

  return (
    <div className={wrapperClasses}>
      {SLOTS.map((slot) => {
        const isCenter = slot === 4;

        if (isCenter) {
          const term = node.term;
          const state: CellState = term ? 'content' : loading ? 'loading' : 'empty';

          if (trail != null) {
            // Center of an outer block — this is one of the 8 secondaries; make it clickable.
            const click =
              state === 'content'
                ? () => onCellClick({ kind: 'secondary', mainIdx: trail.mainIdx })
                : undefined;
            return (
              <Cell
                key={slot}
                tier="secondary"
                state={state}
                content={term}
                onClick={click}
                cellRef={(el) => registerCell?.({ mainIdx: trail.mainIdx }, el)}
              />
            );
          }

          // Center of the center block (or mobile standalone) — the focal topic.
          return <Cell key={slot} tier={tier} state={state} content={term} />;
        }

        // Surrounding slot. childIdx 0..7, skipping the center slot.
        const childIdx = slot < 4 ? slot : slot - 1;
        const child = node.children?.[childIdx];
        const term = child?.term ?? '';
        const state: CellState = term ? 'content' : loading ? 'loading' : 'empty';

        const childTier: Tier = trail != null ? 'tertiary' : 'secondary';
        // Center-3x3 secondaries get compact (tertiary-sized) type, keeping ink color.
        const compact = trail == null;

        const refKey: CellRefKey =
          trail != null ? { mainIdx: trail.mainIdx, subIdx: childIdx } : { mainIdx: childIdx };

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
            compact={compact}
          />
        );
      })}
    </div>
  );
}
