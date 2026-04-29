import { useMemo, useRef } from 'react';
import type { DataState } from '../../types';
import { Level, type CellClick, type CellRefKey, type FractalNode } from './Level';
import { useFlipZoom, type ZoomOrigin } from './useFlipZoom';

type FractalViewProps = {
  data: DataState | null;
  depth: 1 | 2;
  onCellClick: (c: CellClick) => void;
  zoomKey: unknown;
  zoomOrigin: React.MutableRefObject<ZoomOrigin>;
};

export function FractalView({ data, depth, onCellClick, zoomKey, zoomOrigin }: FractalViewProps) {
  const containerRef = useFlipZoom(zoomOrigin, zoomKey);

  const tree = useMemo<FractalNode>(() => buildTree(data), [data]);

  const cellRefs = useRef(new Map<string, HTMLDivElement>());
  const registerCell = (key: CellRefKey, el: HTMLDivElement | null) => {
    const k = key.subIdx == null ? `${key.mainIdx}` : `${key.mainIdx}.${key.subIdx}`;
    if (el) cellRefs.current.set(k, el);
    else cellRefs.current.delete(k);
  };

  const handleCellClick = (c: CellClick) => {
    const k = c.kind === 'secondary' ? `${c.mainIdx}` : `${c.mainIdx}.${c.subIdx}`;
    const el = cellRefs.current.get(k);
    const containerEl = containerRef.current;
    if (el && containerEl) {
      const cellRect = el.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();
      zoomOrigin.current = {
        x: cellRect.left - containerRect.left,
        y: cellRect.top - containerRect.top,
        w: cellRect.width,
        h: cellRect.height,
      };
    }
    onCellClick(c);
  };

  return (
    <div className="relative w-full max-w-[min(560px,92vw)] md:max-w-[min(900px,86vh)] aspect-square mx-auto">
      <div ref={containerRef} className="absolute inset-0 will-change-transform">
        <Level
          node={tree}
          depth={depth}
          tier="primary"
          loading={data?.loading ?? false}
          onCellClick={handleCellClick}
          registerCell={registerCell}
        />
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
