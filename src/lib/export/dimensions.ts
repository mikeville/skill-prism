// Social-media-oriented preset sizes for poster export.
//
// Square (1:1): IG feed, X/Twitter, LinkedIn, Threads — the universal one.
// Vertical (4:5): IG portrait feed, the tallest aspect IG allows on feed.
// Landscape (16:9): X/Twitter card, LinkedIn link preview, OG image.

export type AspectKey = 'square' | 'vertical' | 'landscape';
export type FormatKey = 'png' | 'pdf' | 'svg';

export type Preset = {
  key: AspectKey;
  label: string;
  width: number;
  height: number;
};

export const ASPECT_PRESETS: Record<AspectKey, Preset> = {
  square: { key: 'square', label: 'Square (1:1) — 1080×1080', width: 1080, height: 1080 },
  vertical: { key: 'vertical', label: 'Vertical (4:5) — 1080×1350', width: 1080, height: 1350 },
  landscape: { key: 'landscape', label: 'Landscape (16:9) — 1200×675', width: 1200, height: 675 },
};

export const FORMAT_LABELS: Record<FormatKey, string> = {
  png: 'Image for screen (PNG)',
  pdf: 'Document to print (PDF)',
  svg: 'Vectors (SVG)',
};
