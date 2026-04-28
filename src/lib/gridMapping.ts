// Pure grid-coordinate math. No React, no DOM.
// 9 blocks (3x3) each holding 9 cells (3x3) = 81 cells.
// Block 4 = center; cells indexed 0..8 in reading order; cell 4 = center of its block.

export const BLOCK_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
export const CELL_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

// mainIdx (0..7) -> block index in the 9x9. Skips 4 because that's the center block.
// mainIdx 0->0, 1->1, 2->2, 3->3, 4->5, 5->6, 6->7, 7->8.
export const MAIN_TO_BLOCK: ReadonlyArray<number> = [0, 1, 2, 3, 5, 6, 7, 8];

// (block, cell) -> (row, col) in the flat 9x9.
export function blockCellToRC(b: number, c: number): [number, number] {
  const blockRow = Math.floor(b / 3);
  const blockCol = b % 3;
  const cellRow = Math.floor(c / 3);
  const cellCol = c % 3;
  return [blockRow * 3 + cellRow, blockCol * 3 + cellCol];
}

// In a 3x3 block, cell index 4 is the center. The 8 outer cells map to mainIdx 0..7
// using a "skip 4" pattern: c=0..3 -> mainIdx=c; c=5..8 -> mainIdx=c-1.
export function cellToMainIdx(c: number): number {
  return c < 4 ? c : c - 1;
}

// Same skip-4 pattern, but applied to block index (used for the mirror anchors).
export function blockToMainIdx(b: number): number {
  return b < 4 ? b : b - 1;
}

// Classify a cell by its position alone. Caller combines with content/loading state
// to produce the final 'leaf'/'empty'/'loading' values for outer cells.
export type CellRole = 'topic' | 'centerMain' | 'mirrorMain' | 'leaf';
export function classifyCell(b: number, c: number): CellRole {
  if (b === 4 && c === 4) return 'topic';
  if (b === 4) return 'centerMain'; // b=4, c≠4
  if (c === 4) return 'mirrorMain'; // b≠4, c=4
  return 'leaf';
}

// Coordinate label like "A1" or "I9".
export function cellLabel(b: number, c: number): string {
  return `${BLOCK_LABELS[b]}${CELL_LABELS[c]}`;
}
