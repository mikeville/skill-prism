import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DataState } from '../../types';
import { AnimatingProvider } from '../../contexts/Animating';
import { buildTree } from '../../lib/fractalTree';
import { colsForSlot, rowsForSlot } from '../../lib/gridTracks';
import { Level, type CellClick, type FractalNode } from './Level';

// ZoomIntent is set by App (via FractalView's click handler for zoom-in, or directly for
// zoom-out via handleJump) and consumed once per data change inside FractalView.
export type ZoomIntent =
  | { kind: 'in'; blockSlot: number } // outer-3x3 slot containing the clicked cell (0..8)
  | { kind: 'out'; mainsIdx: number };

type FractalViewProps = {
  data: DataState | null;
  depth: 1 | 2;
  onCellClick: (c: CellClick) => void;
  zoomIntent: React.MutableRefObject<ZoomIntent | null>;
  // Callback ref attached to the morph target — depth=2 primary cell on
  // desktop, depth=1 standalone outer frame on mobile. App.tsx uses this to
  // FLIP-animate from the empty-state input rect on the first transition.
  primaryRef?: (el: HTMLDivElement | null) => void;
};

type ZoomKf = { from: number | null; to: number | null }; // null = full 1fr 1fr 1fr
type Snapshot = {
  tree: FractalNode;
  depth: 1 | 2;
  loading: boolean;
  oldZoom: ZoomKf;
  newZoom: ZoomKf;
};

// Two phases of equal length, plus a brief opacity cross-fade across the swap.
const PHASE_MS = 180;
const ANIM_MS = PHASE_MS * 2; // 360
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const SWAP_FROM = 0.46; // opacity cross-fade window (fraction of ANIM_MS)
const SWAP_TO = 0.54;

export function FractalView({ data, depth, onCellClick, zoomIntent, primaryRef }: FractalViewProps) {
  const newLayerRef = useRef<HTMLDivElement>(null);
  const oldLayerRef = useRef<HTMLDivElement>(null);
  const newGridRef = useRef<HTMLDivElement>(null);
  const oldGridRef = useRef<HTMLDivElement>(null);

  // Animation flag for useFitText: true while a zoom is in flight so cells
  // skip re-fitting during the 360ms transition. Held in a ref + listeners
  // so flipping it doesn't re-render the whole tree.
  const animatingRef = useRef(false);
  const animatingListenersRef = useRef<Set<(v: boolean) => void>>(new Set());
  const animatingCtx = useMemo(
    () => ({
      isAnimating: () => animatingRef.current,
      onChange: (cb: (v: boolean) => void) => {
        animatingListenersRef.current.add(cb);
        return () => {
          animatingListenersRef.current.delete(cb);
        };
      },
    }),
    [],
  );
  const setAnimating = (v: boolean) => {
    if (animatingRef.current === v) return;
    animatingRef.current = v;
    animatingListenersRef.current.forEach((cb) => cb(v));
  };

  const newTree = useMemo<FractalNode>(() => buildTree(data), [data]);
  const newLoading = data?.loading ?? false;

  const [oldSnap, setOldSnap] = useState<Snapshot | null>(null);
  const lastSnapRef = useRef<{ tree: FractalNode; depth: 1 | 2; loading: boolean }>({
    tree: newTree,
    depth,
    loading: newLoading,
  });

  const handleCellClick = (c: CellClick) => {
    // The Level recursion threads the outer-3x3 slot through to each click event, so we can
    // pick the zoom target without doing a fragile DOM lookup. Skip on depth=1 (mobile) — no
    // outer hierarchy, no zoom.
    if (depth === 2 && c.originBlockSlot != null) {
      zoomIntent.current = { kind: 'in', blockSlot: c.originBlockSlot };
    }
    onCellClick(c);
  };

  // Detect a render where the displayed tree changed; resolve the intent into a snapshot.
  useLayoutEffect(() => {
    const last = lastSnapRef.current;
    const treeChanged = last.tree !== newTree || last.loading !== newLoading;
    const depthChanged = last.depth !== depth;

    if (!treeChanged && !depthChanged) return;

    // Depth-only change (sidebar toggle, viewport reflow) — snap, don't animate. Preserve any
    // pending zoomIntent so a near-simultaneous navigation still animates correctly when its
    // tree change lands on the next render.
    if (!treeChanged && depthChanged) {
      lastSnapRef.current = { tree: newTree, depth, loading: newLoading };
      setOldSnap(null);
      return;
    }

    const intent = zoomIntent.current;
    lastSnapRef.current = { tree: newTree, depth, loading: newLoading };
    zoomIntent.current = null;

    // No animation if either the previous or current view is depth=1 (mobile single 3x3) — the
    // grid-template trick relies on the outer/inner hierarchy that only exists at depth=2.
    if (!intent || depth !== 2 || last.depth !== 2) {
      setOldSnap(null);
      return;
    }

    let oldZoom: ZoomKf;
    let newZoom: ZoomKf;
    if (intent.kind === 'in') {
      // OLD collapses so the clicked block fills the wrapper; NEW starts collapsed onto its
      // center 3x3 (which now holds the clicked secondary as its primary), then expands.
      oldZoom = { from: null, to: intent.blockSlot };
      newZoom = { from: 4, to: null };
    } else {
      // Mirror image: OLD collapses onto its own center; NEW starts collapsed onto the outer
      // block representing the term we're leaving, then expands.
      const slot = intent.mainsIdx < 4 ? intent.mainsIdx : intent.mainsIdx + 1;
      oldZoom = { from: null, to: 4 };
      newZoom = { from: slot, to: null };
    }

    setOldSnap({ ...last, oldZoom, newZoom });
  });

  // Run the dual-layer grid-template animation. Cells resize via grid tracks, not transforms,
  // so text stays at its native font-size throughout — that's what makes the swap seamless.
  useLayoutEffect(() => {
    if (!oldSnap) return;
    const { oldZoom, newZoom } = oldSnap;
    const oldGrid = oldGridRef.current;
    const newGrid = newGridRef.current;
    const oldLayer = oldLayerRef.current;
    const newLayer = newLayerRef.current;
    if (!oldGrid || !newGrid || !oldLayer || !newLayer) return;

    const oldGridAnim = oldGrid.animate(
      [
        {
          gridTemplateColumns: colsForSlot(oldZoom.from),
          gridTemplateRows: rowsForSlot(oldZoom.from),
        },
        {
          gridTemplateColumns: colsForSlot(oldZoom.to),
          gridTemplateRows: rowsForSlot(oldZoom.to),
        },
      ],
      { duration: PHASE_MS, easing: EASE, fill: 'forwards' },
    );

    const newGridAnim = newGrid.animate(
      [
        {
          gridTemplateColumns: colsForSlot(newZoom.from),
          gridTemplateRows: rowsForSlot(newZoom.from),
        },
        {
          gridTemplateColumns: colsForSlot(newZoom.to),
          gridTemplateRows: rowsForSlot(newZoom.to),
        },
      ],
      { duration: PHASE_MS, delay: PHASE_MS, easing: EASE, fill: 'forwards' },
    );

    const oldOpacityAnim = oldLayer.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 1, offset: SWAP_FROM },
        { opacity: 0, offset: SWAP_TO },
        { opacity: 0, offset: 1 },
      ],
      { duration: ANIM_MS, fill: 'forwards' },
    );

    const newOpacityAnim = newLayer.animate(
      [
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: SWAP_FROM },
        { opacity: 1, offset: SWAP_TO },
        { opacity: 1, offset: 1 },
      ],
      { duration: ANIM_MS, fill: 'forwards' },
    );

    setAnimating(true);

    let cancelled = false;
    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      oldGridAnim.cancel();
      newGridAnim.cancel();
      oldOpacityAnim.cancel();
      newOpacityAnim.cancel();
      newLayer.style.opacity = '';
      setAnimating(false);
      setOldSnap(null);
    };

    newOpacityAnim.finished.then(finish).catch(() => {
      // animation cancelled — cleanup will handle it
    });
    const backstop = window.setTimeout(finish, ANIM_MS + 80);

    return () => {
      cancelled = true;
      window.clearTimeout(backstop);
      oldGridAnim.cancel();
      newGridAnim.cancel();
      oldOpacityAnim.cancel();
      newOpacityAnim.cancel();
      setAnimating(false);
    };
  }, [oldSnap]);

  return (
    <AnimatingProvider value={animatingCtx}>
      <div
        className="relative w-full h-full box-border"
        style={{
          paddingTop: 0,
          paddingBottom: 'clamp(48px, 6vmin, 72px)',
          paddingLeft: 'calc(clamp(48px, 6vmin, 72px) * var(--inner-aspect, 1))',
          paddingRight: 'calc(clamp(48px, 6vmin, 72px) * var(--inner-aspect, 1))',
        }}
      >
        <div className="relative w-full h-full">
          {oldSnap && (
            <div ref={oldLayerRef} className="absolute inset-0 pointer-events-none">
              <Level
                node={oldSnap.tree}
                depth={oldSnap.depth}
                loading={oldSnap.loading}
                onCellClick={() => {}}
                focusSlot={oldSnap.oldZoom.from}
                gridRef={oldGridRef}
              />
            </div>
          )}
          <div ref={newLayerRef} className="absolute inset-0">
            <Level
              node={newTree}
              depth={depth}
              loading={newLoading}
              onCellClick={handleCellClick}
              focusSlot={oldSnap?.newZoom.from ?? null}
              gridRef={newGridRef}
              primaryRef={primaryRef}
            />
          </div>
        </div>
      </div>
    </AnimatingProvider>
  );
}

