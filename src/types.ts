// Shared types across components, hooks, and lib.

// 9x9 grid as 3x3 of 3x3 blocks. Block 4 = center; cells indexed 0..8 in reading order.
// Status drives both styling (weight hierarchy) and click behavior.
export type CellStatus =
  | 'topic' // b=4, c=4 — focal topic (boldest, weight 800)
  | 'centerMain' // b=4, c≠4 — 8 mains in centermost block (weight 600)
  | 'mirrorMain' // b≠4, c=4 — 8 mirrored mains anchoring outer blocks (weight 500)
  | 'leaf' // b≠4, c≠4 — 64 sub-sub-skills (weight 300)
  | 'empty' // no content yet
  | 'loading'; // request in flight

// Path from root topic to current focus, e.g. ['Linear Algebra', 'Eigenvalues'].
export type Path = string[];

// One breakdown response: 8 mains and 8 sub-arrays keyed by outer-block index.
// `subs` keys are values from MAIN_TO_BLOCK (0,1,2,3,5,6,7,8) — never 4.
export type Breakdown = {
  mains: string[]; // length 8
  subs: Record<number, string[]>; // 8 keys, each array length 8
};

// What App stores for the currently-displayed grid.
export type DataState = {
  topic: string;
  mains: string[];
  subs: Record<number, string[]>;
  loading: boolean;
};

// Runtime-tweakable values exposed via the Tweaks panel.
export type TweakValues = {
  accent: string;
  fontFamily: 'Inter' | 'Manrope' | 'System';
  lineWeight: number;
  density: 'compact' | 'comfortable';
  showCoords: boolean;
  background: string;
};
