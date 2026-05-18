import type { CellState, Tier } from '../../types';
import { REST_TRACKS, trackTemplate } from '../../lib/gridTracks';
import { Cell } from '../Cell/Cell';

export type FractalNode = {
  term: string;
  children?: FractalNode[];
};

export type CellClick =
  | { kind: 'secondary'; mainIdx: number; originBlockSlot?: number }
  | { kind: 'tertiary'; mainIdx: number; subIdx: number; originBlockSlot?: number };

type LevelProps = {
  node: FractalNode;
  depth: 1 | 2;
  loading: boolean;
  onCellClick: (c: CellClick) => void;
  trail?: { mainIdx: number };
  // standalone=true → this depth=1 grid renders its own dark frame (mobile single-grid).
  // standalone=false → it sits inside a depth=2 outer wrapper that already paints the dark gaps + frame.
  standalone?: boolean;
  // For zoom animations on depth=2: when set, the outer 3x3 collapses to focus on this slot
  // (only its row/column at 1fr; the others at 0fr so the focused block fills the wrapper).
  focusSlot?: number | null;
  // Ref to the outer 3x3 grid div (depth=2 only) so FractalView can animate grid-template-* on it.
  gridRef?: React.RefObject<HTMLDivElement>;
  // Slot 0..8 of the outer 3x3 that this depth=1 Level lives inside (set by the depth=2 parent
  // during recursion). Threads through into CellClick events so FractalView knows which 3x3
  // block to zoom into without doing a fragile DOM lookup.
  outerBlockSlot?: number;
  // Callback ref attached to the morph target — the depth=2 primary cell on
  // desktop, or the depth=1 standalone outer frame on mobile. App.tsx uses
  // this to FLIP-animate from the empty-state input rect.
  primaryRef?: (el: HTMLDivElement | null) => void;
};

const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function Level({
  node,
  depth,
  loading,
  onCellClick,
  trail,
  standalone = true,
  focusSlot,
  gridRef,
  outerBlockSlot,
  primaryRef,
}: LevelProps) {
  if (depth === 2) {
    // Outer 3x3. The 1px gap + 1px padding on bg-divider paints subtle group
    // dividers + outer frame. focusSlot collapses non-focused rows/cols to
    // 0fr — used by FractalView's zoom animation. At rest the center is 2fr
    // so the focal block dominates the layout.
    const gridStyle: React.CSSProperties =
      focusSlot != null
        ? {
            gridTemplateColumns: trackTemplate(focusSlot % 3),
            gridTemplateRows: trackTemplate(Math.floor(focusSlot / 3)),
          }
        : { gridTemplateColumns: REST_TRACKS, gridTemplateRows: REST_TRACKS };
    return (
      <div
        ref={gridRef}
        className="grid gap-px p-px w-full h-full bg-line-meta overflow-hidden"
        style={gridStyle}
      >
        {SLOTS.map((slot) => {
          const isCenter = slot === 4;
          if (isCenter) {
            // Center block — the focal topic, rendered as a single Cell that
            // fills the entire center slot of the outer 3×3. The 8 mains used
            // to surround the focal here too, but they already appear as the
            // centers of the 8 perimeter blocks; rendering them twice was
            // redundant. Removing them here lets the focal grow 3× linearly.
            const term = node.term;
            const state: CellState = term ? 'content' : loading ? 'loading' : 'empty';
            return (
              <Cell
                key={slot}
                tier="primary"
                state={state}
                content={term}
                domRef={primaryRef}
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
              loading={loading}
              onCellClick={onCellClick}
              trail={{ mainIdx: childIdx }}
              standalone={false}
              outerBlockSlot={slot}
            />
          );
        })}
      </div>
    );
  }

  // depth === 1: a 3×3 block of equal-size cells. Inner hairlines use the
  // same fainter colour as the inner-block dividers (#f4f4f4); standalone
  // mode (mobile single-grid) wraps in a dark frame matching desktop's outer
  // 3×3 frame so mobile reads as a slice of the same visual system.
  // Perimeter blocks (Level instances inside the outer 3×3) get data-perimeter
  // so the empty→active morph can fade them in around the primary cell. The
  // mobile standalone case (the entire grid) doesn't, since there's no
  // perimeter — the standalone wrapper IS the morph target.
  const isPerimeter = !standalone;
  const innerGrid = (
    <div
      className="grid gap-px w-full h-full bg-line-cell overflow-hidden"
      style={{ gridTemplateColumns: REST_TRACKS, gridTemplateRows: REST_TRACKS }}
      data-perimeter={isPerimeter ? '' : undefined}
    >
      {SLOTS.map((slot) => {
        const isCenter = slot === 4;

        if (isCenter) {
          const term = node.term;
          const state: CellState = term ? 'content' : loading ? 'loading' : 'empty';

          if (trail != null) {
            // Center of an outer block — this is one of the 8 secondaries; make it clickable.
            const click =
              state === 'content'
                ? () =>
                    onCellClick({
                      kind: 'secondary',
                      mainIdx: trail.mainIdx,
                      originBlockSlot: outerBlockSlot,
                    })
                : undefined;
            return (
              <Cell key={slot} tier="secondary" state={state} content={term} onClick={click} />
            );
          }

          // Center of the center block (or mobile standalone) — the focal topic.
          return <Cell key={slot} tier="primary" state={state} content={term} />;
        }

        // Surrounding slot. childIdx 0..7, skipping the center slot.
        const childIdx = slot < 4 ? slot : slot - 1;
        const child = node.children?.[childIdx];
        const term = child?.term ?? '';
        const state: CellState = term ? 'content' : loading ? 'loading' : 'empty';

        const childTier: Tier = trail != null ? 'tertiary' : 'secondary';
        // Center-3x3 secondaries get compact (tertiary-sized) type, keeping ink color.
        const compact = trail == null;

        const click =
          trail != null
            ? () =>
                onCellClick({
                  kind: 'tertiary',
                  mainIdx: trail.mainIdx,
                  subIdx: childIdx,
                  originBlockSlot: outerBlockSlot,
                })
            : () =>
                onCellClick({
                  kind: 'secondary',
                  mainIdx: childIdx,
                  originBlockSlot: outerBlockSlot,
                });

        return (
          <Cell
            key={slot}
            tier={childTier}
            state={state}
            content={term}
            onClick={state === 'content' ? click : undefined}
            compact={compact}
          />
        );
      })}
    </div>
  );

  if (!standalone) return innerGrid;

  // Mobile single-grid: dark outer frame matching desktop's outer-3×3 frame.
  // This wrapper is the morph target on mobile (the empty-state input grows
  // into this entire frame, then the inner 3×3 fades in inside it).
  //
  // Forced 3:4 portrait aspect on mobile (was: w-full h-full which gave very
  // tall ~9:21 cells). Each cell ends up ~3:4 too — still portrait but far
  // less extreme — which makes typography easier to fit and improves cross-
  // cell cap/baseline alignment. The grid is centered in the available
  // vertical space via the flex wrapper.
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        ref={primaryRef}
        className="bg-line-meta p-px overflow-hidden"
        style={{ aspectRatio: '3 / 4', width: '100%', maxHeight: '100%' }}
      >
        {innerGrid}
      </div>
    </div>
  );
}
