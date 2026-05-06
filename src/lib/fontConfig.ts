// Display typeface registry. The active font is selected at runtime via the
// TypefaceContext; fitText.ts and Cell.tsx read it via getActiveFont() so a
// switch propagates to the next render + re-fit pass.
//
// Each FontConfig declares the font's variable axes (wdth/wght/opsz) so the
// fit algorithm can pick the safe range. Fonts missing an axis (e.g. Anybody
// has no opsz) just get a synthetic range — the browser ignores axis settings
// the font doesn't expose.

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

export const BRICOLAGE_GROTESQUE: FontConfig = {
  family: '"Bricolage Grotesque Variable", Inter, sans-serif',
  axes: { wdth: [75, 100], wght: [200, 800], opsz: [12, 96] },
  lineHeight: 0.82,
  aaPreview: { wdth: 100, wght: 800 },
  cellStaticDisplay: { wdth: 100, wght: 600 },
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

export type TypefaceKey = 'roboto' | 'bricolage' | 'anybody';

export const FONTS: Record<TypefaceKey, FontConfig> = {
  roboto: ROBOTO_FLEX,
  bricolage: BRICOLAGE_GROTESQUE,
  anybody: ANYBODY,
};

export const TYPEFACE_LABELS: Record<TypefaceKey, string> = {
  roboto: 'Roboto Flex',
  bricolage: 'Bricolage Grotesque',
  anybody: 'Anybody',
};

export const TYPEFACE_KEYS: TypefaceKey[] = ['roboto', 'bricolage', 'anybody'];

let activeKey: TypefaceKey = 'roboto';

export function setActiveFont(key: TypefaceKey): void {
  activeKey = key;
}

export function getActiveFontKey(): TypefaceKey {
  return activeKey;
}

export function getActiveFont(): FontConfig {
  return FONTS[activeKey];
}
