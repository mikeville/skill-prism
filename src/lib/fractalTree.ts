import type { DataState } from '../types';
import type { FractalNode } from '../components/FractalView/Level';

// Convert the flat DataState (topic + mains + subs) into the recursive
// FractalNode shape consumed by Level. Used by FractalView (live render) and
// ExportCanvas (offscreen export render).
export function buildTree(data: DataState | null): FractalNode {
  if (!data) return { term: '', children: undefined };
  return {
    term: data.topic,
    children: data.mains.map((main, i) => ({
      term: main,
      children: data.subs[i]?.map((sub) => ({ term: sub })) ?? [],
    })),
  };
}
