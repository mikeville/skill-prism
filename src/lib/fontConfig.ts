// Single source of truth for the active display typeface. To swap fonts:
//   1. npm install @fontsource-variable/<new-font>
//   2. Update the import in src/main.tsx
//   3. Update tailwind.config.cjs `display` family stack
//   4. Define a new FontConfig below and re-alias FONT_CONFIG to it
//
// Candidate typefaces must expose all three standard variable axes:
// wdth, wght, opsz. Fonts missing any of these won't drop in without
// algorithm changes in fitText.ts.

export type FontConfig = {
  family: string;
  axes: {
    wdth: [min: number, max: number];
    wght: [min: number, max: number];
    opsz: [min: number, max: number];
  };
  // Line-box-to-fontSize ratio matching the font's cap height so display
  // lines sit flush with cell top/bottom. Recalibrate per font: roughly
  // (capHeight / unitsPerEm) + a small fudge for descender clearance.
  lineHeight: number;
  // Topbar "Aa" preview values — usually the font's most extreme axes.
  aaPreview: { wdth: number; wght: number };
  // Static display value used by Cell.tsx when fitMultiline isn't running
  // (e.g. before measurement). Pick mid-range, comfortable defaults.
  cellStaticDisplay: { wdth: number; wght: number };
};

export const ROBOTO_FLEX: FontConfig = {
  family: '"Roboto Flex Variable", Inter, sans-serif',
  axes: { wdth: [25, 151], wght: [200, 1000], opsz: [8, 144] },
  lineHeight: 0.78,
  aaPreview: { wdth: 151, wght: 900 },
  cellStaticDisplay: { wdth: 100, wght: 600 },
};

export const FONT_CONFIG: FontConfig = ROBOTO_FLEX;
