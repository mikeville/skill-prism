import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DataState } from '../../types';
import { Level, type CellClick, type CellRefKey, type FractalNode } from './Level';

type Rect = { x: number; y: number; w: number; h: number };

// ZoomIntent is set by App (via FractalView's click handler for zoom-in, or directly for
// zoom-out via handleJump) and consumed once per data change inside FractalView.
export type ZoomIntent =
  | { kind: 'in'; rect: Rect } // rect is the clicked cell's rect inside the wrapper
  | { kind: 'out'; mainsIdx: number }; // mainsIdx of the term we're zooming OUT FROM in the parent's grid

type FractalViewProps = {
  data: DataState | null;
  depth: 1 | 2;
  onCellClick: (c: CellClick) => void;
  zoomIntent: React.MutableRefObject<ZoomIntent | null>;
};

type ResolvedZoom = { rect: Rect; direction: 'in' | 'out' };
type Snapshot = {
  tree: FractalNode;
  depth: 1 | 2;
  loading: boolean;
  zoom: ResolvedZoom;
};

const ANIM_MS = 520;
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
// Zoom-in is two phases: pan toward the click, then zoom in. The split point is the fraction
// of the duration spent on the pan phase before the zoom takes over.
const PAN_SPLIT = 0.42;

export function FractalView({ data, depth, onCellClick, zoomIntent }: FractalViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const newLayerRef = useRef<HTMLDivElement>(null);
  const oldLayerRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<string, HTMLDivElement>());

  const newTree = useMemo<FractalNode>(() => buildTree(data), [data]);
  const newLoading = data?.loading ?? false;

  const [oldSnap, setOldSnap] = useState<Snapshot | null>(null);
  const lastSnapRef = useRef<{ tree: FractalNode; depth: 1 | 2; loading: boolean }>({
    tree: newTree,
    depth,
    loading: newLoading,
  });

  const registerCell = (key: CellRefKey, el: HTMLDivElement | null) => {
    const k = key.subIdx == null ? `${key.mainIdx}` : `${key.mainIdx}.${key.subIdx}`;
    if (el) cellRefs.current.set(k, el);
    else cellRefs.current.delete(k);
  };

  const handleCellClick = (c: CellClick) => {
    const k = c.kind === 'secondary' ? `${c.mainIdx}` : `${c.mainIdx}.${c.subIdx}`;
    const el = cellRefs.current.get(k);
    const wrapperEl = wrapperRef.current;
    if (el && wrapperEl) {
      const cellRect = el.getBoundingClientRect();
      const wrapperRect = wrapperEl.getBoundingClientRect();
      zoomIntent.current = {
        kind: 'in',
        rect: {
          x: cellRect.left - wrapperRect.left,
          y: cellRect.top - wrapperRect.top,
          w: cellRect.width,
          h: cellRect.height,
        },
      };
    }
    onCellClick(c);
  };

  // Detect a render where the displayed tree changed; resolve the intent and capture old snapshot.
  useLayoutEffect(() => {
    const last = lastSnapRef.current;
    const sameTree = last.tree === newTree && last.depth === depth && last.loading === newLoading;
    if (sameTree) return;

    const intent = zoomIntent.current;
    lastSnapRef.current = { tree: newTree, depth, loading: newLoading };

    if (!intent) {
      setOldSnap(null);
      return;
    }

    const wrapper = wrapperRef.current;
    if (!wrapper) {
      zoomIntent.current = null;
      return;
    }
    const wrapperRect = wrapper.getBoundingClientRect();

    let resolved: ResolvedZoom | null = null;
    if (intent.kind === 'in') {
      resolved = { rect: intent.rect, direction: 'in' };
    } else {
      const rect = gridCellRect(intent.mainsIdx, wrapperRect.width, wrapperRect.height, depth);
      if (rect) resolved = { rect, direction: 'out' };
    }

    zoomIntent.current = null;
    if (!resolved) {
      setOldSnap(null);
      return;
    }

    setOldSnap({ ...last, zoom: resolved });
  });

  // Run the dual-layer animation once both layers are mounted. Storing zoom in oldSnap (state)
  // keeps the effect idempotent under StrictMode's dev-only setup → cleanup → setup loop.
  useLayoutEffect(() => {
    if (!oldSnap) return;
    const wrapper = wrapperRef.current;
    const newLayer = newLayerRef.current;
    const oldLayer = oldLayerRef.current;
    if (!wrapper || !newLayer || !oldLayer) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const W = wrapperRect.width;
    const H = wrapperRect.height;
    if (W === 0 || H === 0) {
      setOldSnap(null);
      return;
    }

    const { rect, direction } = oldSnap.zoom;
    const sx = W / rect.w;
    const sy = H / rect.h;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;

    // Five named transforms used as keyframe building blocks:
    const identity = 'translate(0px, 0px) scale(1, 1)';
    // OLD-side cell-fits-screen (parent grid scaled up so click cell fills viewport).
    const oldZoomFull = `translate(${-rect.x * sx}px, ${-rect.y * sy}px) scale(${sx}, ${sy})`;
    // OLD-side pan-only (click cell shifted to screen center, no zoom yet).
    const oldPanOnly = `translate(${W / 2 - cx}px, ${H / 2 - cy}px) scale(1, 1)`;
    // NEW-side cell-footprint (new grid squished into click cell rect).
    const newCellFit = `translate(${rect.x}px, ${rect.y}px) scale(${1 / sx}, ${1 / sy})`;
    // NEW-side pan-only midpoint (still squished, but centered on screen).
    const newPanOnly = `translate(${(W - rect.w) / 2}px, ${(H - rect.h) / 2}px) scale(${1 / sx}, ${1 / sy})`;

    let oldKeyframes: Keyframe[];
    let newKeyframes: Keyframe[];

    if (direction === 'in') {
      // Pan-then-zoom: during 0..PAN_SPLIT the camera moves toward the click; during
      // PAN_SPLIT..1 the click cell expands in place.
      oldKeyframes = [
        { transform: identity, opacity: 1, offset: 0 },
        { transform: oldPanOnly, opacity: 1, offset: PAN_SPLIT },
        { transform: oldZoomFull, opacity: 0, offset: 1 },
      ];
      newKeyframes = [
        { transform: newCellFit, opacity: 0, offset: 0 },
        { transform: newPanOnly, opacity: 0, offset: PAN_SPLIT },
        { transform: identity, opacity: 1, offset: 1 },
      ];
    } else {
      // Single-phase out: old shrinks toward the parent's target cell while new resolves
      // from scaled-up to identity. (User confirmed this feels right already.)
      oldKeyframes = [
        { transform: identity, opacity: 1, offset: 0 },
        { transform: newCellFit, opacity: 0, offset: 1 },
      ];
      newKeyframes = [
        { transform: oldZoomFull, opacity: 0, offset: 0 },
        { transform: identity, opacity: 1, offset: 1 },
      ];
    }

    const opts: KeyframeAnimationOptions = {
      duration: ANIM_MS,
      easing: EASE,
      fill: 'forwards',
    };

    const oldAnim = oldLayer.animate(oldKeyframes, opts);
    const newAnim = newLayer.animate(newKeyframes, opts);

    let cancelled = false;
    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      try {
        newAnim.commitStyles();
      } catch {
        // ignore — element may have been removed
      }
      newAnim.cancel();
      newLayer.style.transform = '';
      newLayer.style.opacity = '';
      setOldSnap(null);
    };

    // Whichever fires first wins. The Promise is the spec'd path; the timer is a backstop in case
    // the page is throttled or the element gets unmounted before the animation event dispatches.
    newAnim.finished.then(finish).catch(() => {
      // animation cancelled — cleanup will handle it
    });
    const backstop = window.setTimeout(finish, ANIM_MS + 80);

    return () => {
      cancelled = true;
      window.clearTimeout(backstop);
      oldAnim.cancel();
      newAnim.cancel();
    };
  }, [oldSnap]);

  return (
    <div className="relative w-full h-full p-8 border-cell border-line box-border">
      <div ref={wrapperRef} className="relative w-full h-full">
        {oldSnap && (
          <div
            ref={oldLayerRef}
            className="absolute inset-0 pointer-events-none will-change-transform"
            style={{ transformOrigin: '0 0' }}
          >
            <Level
              node={oldSnap.tree}
              depth={oldSnap.depth}
              tier="primary"
              loading={oldSnap.loading}
              onCellClick={() => {}}
            />
          </div>
        )}
        <div
          ref={newLayerRef}
          className="absolute inset-0 will-change-transform"
          style={{ transformOrigin: '0 0' }}
        >
          <Level
            node={newTree}
            depth={depth}
            tier="primary"
            loading={newLoading}
            onCellClick={handleCellClick}
            registerCell={registerCell}
          />
        </div>
      </div>
    </div>
  );
}

// Compute the rect of the cell that displays mains[mainsIdx] inside the rendered grid.
// At depth=2 (desktop): mains[k] sits at the center of the outer block at slot s = k<4 ? k : k+1
// (skipping the center slot). The grid is 9 cells wide, so the cell is at grid (col, row) =
// (outerCol*3 + 1, outerRow*3 + 1). At depth=1 (mobile): mains[k] sits at slot s in a 3x3.
function gridCellRect(mainsIdx: number, W: number, H: number, depth: 1 | 2): Rect | null {
  if (mainsIdx < 0 || mainsIdx > 7) return null;
  const slot = mainsIdx < 4 ? mainsIdx : mainsIdx + 1;

  if (depth === 2) {
    const outerCol = slot % 3;
    const outerRow = Math.floor(slot / 3);
    const cellCol = outerCol * 3 + 1;
    const cellRow = outerRow * 3 + 1;
    const cellW = W / 9;
    const cellH = H / 9;
    return { x: cellCol * cellW, y: cellRow * cellH, w: cellW, h: cellH };
  }

  // depth === 1
  const col = slot % 3;
  const row = Math.floor(slot / 3);
  const cellW = W / 3;
  const cellH = H / 3;
  return { x: col * cellW, y: row * cellH, w: cellW, h: cellH };
}

function buildTree(data: DataState | null): FractalNode {
  if (!data) return { term: '', children: undefined };
  return {
    term: data.topic,
    children: data.mains.map((main, i) => ({
      term: main,
      children: data.subs[i]?.map((sub) => ({ term: sub })) ?? [],
    })),
  };
}
