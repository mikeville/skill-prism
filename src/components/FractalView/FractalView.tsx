import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DataState } from '../../types';
import { Level, type CellClick, type CellRefKey, type FractalNode } from './Level';

export type ZoomOrigin = { x: number; y: number; w: number; h: number } | null;

type FractalViewProps = {
  data: DataState | null;
  depth: 1 | 2;
  onCellClick: (c: CellClick) => void;
  zoomOrigin: React.MutableRefObject<ZoomOrigin>;
};

type Snapshot = { tree: FractalNode; depth: 1 | 2; loading: boolean };

export function FractalView({ data, depth, onCellClick, zoomOrigin }: FractalViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const newLayerRef = useRef<HTMLDivElement>(null);
  const oldLayerRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<string, HTMLDivElement>());

  const newTree = useMemo<FractalNode>(() => buildTree(data), [data]);
  const newLoading = data?.loading ?? false;

  // Old snapshot kept mounted during the dual-layer zoom animation.
  const [oldSnap, setOldSnap] = useState<Snapshot | null>(null);
  // Origin captured at click time, applied once layers are mounted.
  const pendingOriginRef = useRef<ZoomOrigin>(null);
  // Last committed render — compared against the current props to detect a transition.
  const lastSnapRef = useRef<Snapshot>({ tree: newTree, depth, loading: newLoading });

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
      zoomOrigin.current = {
        x: cellRect.left - wrapperRect.left,
        y: cellRect.top - wrapperRect.top,
        w: cellRect.width,
        h: cellRect.height,
      };
    }
    onCellClick(c);
  };

  // Detect a render where the displayed tree changed; capture old state and stash the origin.
  useLayoutEffect(() => {
    const last = lastSnapRef.current;
    const sameTree = last.tree === newTree && last.depth === depth && last.loading === newLoading;
    if (sameTree) return;

    const origin = zoomOrigin.current;
    lastSnapRef.current = { tree: newTree, depth, loading: newLoading };
    if (origin == null) {
      // No zoom origin — instant swap (e.g., breadcrumb back, reset).
      setOldSnap(null);
      pendingOriginRef.current = null;
      return;
    }

    pendingOriginRef.current = origin;
    zoomOrigin.current = null;
    setOldSnap(last);
  });

  // Run the dual-layer animation once the old layer is mounted alongside the new.
  useLayoutEffect(() => {
    if (!oldSnap) return;
    const origin = pendingOriginRef.current;
    pendingOriginRef.current = null;
    if (!origin) return;

    const wrapper = wrapperRef.current;
    const newLayer = newLayerRef.current;
    const oldLayer = oldLayerRef.current;
    if (!wrapper || !newLayer || !oldLayer) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    if (wrapperRect.width === 0 || wrapperRect.height === 0) {
      setOldSnap(null);
      return;
    }

    const scaleX = origin.w / wrapperRect.width;
    const scaleY = origin.h / wrapperRect.height;
    // Use uniform scale = average so non-square cells still look like a coherent zoom.
    const scale = (scaleX + scaleY) / 2;

    const newStart = `translate(${origin.x}px, ${origin.y}px) scale(${scale})`;
    const oldEnd = `translate(${-origin.x / scale}px, ${-origin.y / scale}px) scale(${1 / scale})`;
    const ease = 'transform 380ms cubic-bezier(0.4, 0, 0.2, 1), opacity 280ms ease-out';

    // Start state — transitions disabled, force paint.
    newLayer.style.transition = 'none';
    newLayer.style.transform = newStart;
    newLayer.style.opacity = '0.4';
    oldLayer.style.transition = 'none';
    oldLayer.style.transform = '';
    oldLayer.style.opacity = '1';
    void newLayer.offsetHeight;

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        newLayer.style.transition = ease;
        newLayer.style.transform = 'translate(0, 0) scale(1)';
        newLayer.style.opacity = '1';
        oldLayer.style.transition = ease;
        oldLayer.style.transform = oldEnd;
        oldLayer.style.opacity = '0';
      });
    });

    // transitionend is flaky under StrictMode's effect double-invoke; use a duration-matched
    // timer instead — it's the same 380ms either way.
    const finishTimer = window.setTimeout(() => {
      newLayer.style.transition = '';
      newLayer.style.transform = '';
      newLayer.style.opacity = '';
      setOldSnap(null);
    }, 420);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(finishTimer);
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
