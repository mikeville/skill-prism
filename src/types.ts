export type Tier = 'primary' | 'secondary' | 'tertiary';
export type CellState = 'content' | 'empty' | 'loading';

export type Path = string[];

// Breakdown: 8 mains, plus 8 sub-arrays (one per main, each length 8).
// subs[i] are the children of mains[i].
export type Breakdown = {
  mains: string[];
  subs: string[][];
};

export type DataState = {
  topic: string;
  mains: string[];
  subs: string[][];
  loading: boolean;
};

export type TweakValues = {
  density: 'compact' | 'comfortable';
  showCoords: boolean;
  depthOverride: 'auto' | '1' | '2';
};
