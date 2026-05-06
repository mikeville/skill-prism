// Display typeface — Anybody is the only font in use across the app.
// fitText.ts and Cell.tsx still go through getActiveFont() so the fit hook
// can read axis ranges + line-height without knowing which font it is.

export type FontConfig = {
  family: string;
  axes: {
    wdth: [min: number, max: number];
    wght: [min: number, max: number];
    opsz: [min: number, max: number];
  };
  // Line-box-to-fontSize ratio matching the font's cap height so display
  // lines sit flush with cell top/bottom.
  lineHeight: number;
  // Topbar "Aa" preview values — usually the font's most extreme axes.
  aaPreview: { wdth: number; wght: number };
  // Static display value used by Cell.tsx when fitMultiline isn't running
  // (e.g. before measurement). Pick mid-range, comfortable defaults.
  cellStaticDisplay: { wdth: number; wght: number };
};

export const ANYBODY: FontConfig = {
  // Anybody has no opsz axis; we still expose a synthetic range so the
  // fit algorithm has a sane fontSize lower bound.
  family: '"Anybody Variable", Inter, sans-serif',
  axes: { wdth: [50, 150], wght: [100, 900], opsz: [10, 200] },
  lineHeight: 0.8,
  aaPreview: { wdth: 150, wght: 900 },
  cellStaticDisplay: { wdth: 100, wght: 600 },
};

export function getActiveFont(): FontConfig {
  return ANYBODY;
}
