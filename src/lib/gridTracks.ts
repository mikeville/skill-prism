// Shared 3-track grid templates. Used by both the static Level layout and the
// FractalView zoom animation: at rest every row/column is 1fr; when zooming,
// one track gets 1fr and the other two collapse to 0fr so the focused slot
// fills the wrapper.

export const REST_TRACKS = '1fr 1fr 1fr';

export function trackTemplate(focusedIdx: number): string {
  return [0, 1, 2].map((i) => (i === focusedIdx ? '1fr' : '0fr')).join(' ');
}

export function colsForSlot(slot: number | null): string {
  return slot == null ? REST_TRACKS : trackTemplate(slot % 3);
}

export function rowsForSlot(slot: number | null): string {
  return slot == null ? REST_TRACKS : trackTemplate(Math.floor(slot / 3));
}
