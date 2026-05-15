// Convert a text run into an SVG path data string using opentype.js.
//
// Outlining text to paths is what makes the SVG export reliably editable in
// Illustrator / Figma / Inkscape: those tools don't need the original font
// installed and don't have to grapple with `font-variation-settings` for
// variable fonts. The trade-off is no live/editable text in the SVG — text
// becomes vector shapes only.
//
// The Anybody Variable font is loaded once per session and cached.

// fontkit handles variable fonts properly (wdth/wght axes deform glyphs as
// expected), unlike opentype.js whose variation support is incomplete for
// font-stretch axes. We ship a pre-decompressed TTF (see
// scripts/decompress-font.sh) so the runtime path needs only fontkit.
// @ts-expect-error — fontkit has no type definitions
import { create as fontkitCreate } from 'fontkit';
import anybodyTtfUrl from '../../assets/anybody-latin.ttf?url';

type Axes = { wdth?: number; wght?: number; opsz?: number };

interface FontkitGlyph {
  path: { toSVG(): string };
  advanceWidth: number;
}
interface FontkitGlyphPosition {
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
}
interface FontkitGlyphRun {
  glyphs: FontkitGlyph[];
  positions: FontkitGlyphPosition[];
  advanceWidth: number;
}
interface FontkitFont {
  unitsPerEm: number;
  // Cap height in font units — distance from baseline to top of uppercase
  // letters. Used to anchor baseline placement against the rendered cap-top
  // rather than against the CSS bounding rect (which varies with
  // text-box-trim across browsers/Illustrator).
  capHeight: number;
  getVariation(settings: Axes): FontkitFont;
  layout(str: string): FontkitGlyphRun;
}

export async function getCapHeightFraction(): Promise<number> {
  const font = await loadFont();
  return font.capHeight / font.unitsPerEm;
}

let cachedFont: FontkitFont | null = null;
let pending: Promise<FontkitFont> | null = null;

async function loadFont(): Promise<FontkitFont> {
  if (cachedFont) return cachedFont;
  if (pending) return pending;
  pending = (async () => {
    const res = await fetch(anybodyTtfUrl);
    const buf = await res.arrayBuffer();
    cachedFont = fontkitCreate(new Uint8Array(buf)) as FontkitFont;
    return cachedFont;
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}

export async function preloadFont(): Promise<void> {
  await loadFont();
}

// Lay out a string at the given axes, returning per-glyph SVG path data,
// positions, and the total advance.
async function layout(
  text: string,
  fontSize: number,
  axes: Axes,
  letterSpacingPx: number,
): Promise<{ paths: string[]; positions: { x: number; y: number }[]; advance: number }> {
  const font = await loadFont();
  // Filter out NaN/undefined axes so getVariation doesn't break.
  const cleanAxes: Axes = {};
  if (typeof axes.wdth === 'number' && !Number.isNaN(axes.wdth)) cleanAxes.wdth = axes.wdth;
  if (typeof axes.wght === 'number' && !Number.isNaN(axes.wght)) cleanAxes.wght = axes.wght;
  if (typeof axes.opsz === 'number' && !Number.isNaN(axes.opsz)) cleanAxes.opsz = axes.opsz;

  const varFont = Object.keys(cleanAxes).length > 0 ? font.getVariation(cleanAxes) : font;
  const run = varFont.layout(text);
  const scale = fontSize / varFont.unitsPerEm;

  const paths: string[] = [];
  const positions: { x: number; y: number }[] = [];
  let xCursor = 0;
  for (let i = 0; i < run.glyphs.length; i++) {
    const g = run.glyphs[i];
    const p = run.positions[i];
    const gx = xCursor + (p.xOffset ?? 0) * scale;
    const gy = -(p.yOffset ?? 0) * scale;
    paths.push(g.path.toSVG());
    positions.push({ x: gx, y: gy });
    xCursor += (p.xAdvance ?? 0) * scale + letterSpacingPx;
  }
  // The total advance subtracts the trailing letter-spacing slot — match CSS
  // letter-spacing where the gap appears between, not after, glyphs.
  const advance = run.glyphs.length === 0 ? 0 : xCursor - letterSpacingPx;
  return { paths, positions, advance };
}

// Returns one combined path-data string with all glyphs positioned. We wrap
// each glyph in its own transform so the caller can place it at (x, y) at the
// right scale. Glyphs sit on the baseline at y, with x as the start of the
// run (the caller is responsible for left/center/right alignment).
export async function textToPathData(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  axes: Axes,
  letterSpacingPx: number,
): Promise<string> {
  const { paths, positions } = await layout(text, fontSize, axes, letterSpacingPx);
  const font = await loadFont();
  const scale = fontSize / font.unitsPerEm;
  // Each glyph's path is in font-unit space with y-up. Translate to baseline
  // coords (y-down) by negating y and scaling.
  let out = '';
  for (let i = 0; i < paths.length; i++) {
    const px = x + positions[i].x;
    const py = y + positions[i].y;
    // SVG path transforms via `transform` attr on a wrapping <g> are nicer but
    // we can't put them inline in a single <path>. Instead, parse the SVG path
    // string and apply (scale, translate) by rewriting each command's coords.
    out += transformPathData(paths[i], px, py, scale);
  }
  return out;
}

export async function measureTextWidth(
  text: string,
  fontSize: number,
  axes: Axes,
  letterSpacingPx: number,
): Promise<number> {
  const r = await layout(text, fontSize, axes, letterSpacingPx);
  return r.advance;
}

// Apply a uniform translate + scale to an SVG path-data string. fontkit emits
// commands like "M120,40 L240,80 Q..." with absolute coordinates in font-unit
// space and y-up. We scale by `scale`, flip the y axis, then translate to
// (tx, ty). The result is a path drawing on the SVG canvas with y-down.
function transformPathData(d: string, tx: number, ty: number, scale: number): string {
  // Tokens: command letter followed by zero or more numbers.
  const tokens = d.match(/([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g);
  if (!tokens) return '';
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (/^[a-zA-Z]$/.test(cmd)) {
      out.push(cmd);
      const upper = cmd.toUpperCase();
      // Number of params per command (uppercase = absolute).
      const argCounts: Record<string, number> = {
        M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7, Z: 0,
      };
      const n = argCounts[upper];
      // Some commands repeat with the same letter (e.g., M x,y x2,y2 = M x,y L x2,y2)
      // — we just parse n numbers and move on.
      if (n === 0) continue;
      const isHorz = upper === 'H';
      const isVert = upper === 'V';
      if (isHorz) {
        const x = parseFloat(tokens[i++]);
        out.push(String(x * scale + tx));
      } else if (isVert) {
        const yv = parseFloat(tokens[i++]);
        out.push(String(-yv * scale + ty));
      } else if (upper === 'A') {
        // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
        const rx = parseFloat(tokens[i++]);
        const ry = parseFloat(tokens[i++]);
        const rot = parseFloat(tokens[i++]);
        const laf = parseFloat(tokens[i++]);
        const sf = parseFloat(tokens[i++]);
        const x = parseFloat(tokens[i++]);
        const yv = parseFloat(tokens[i++]);
        out.push(String(rx * scale));
        out.push(String(ry * scale));
        out.push(String(rot));
        out.push(String(laf));
        out.push(String(sf));
        out.push(String(x * scale + tx));
        out.push(String(-yv * scale + ty));
      } else {
        // Pairs of (x, y).
        for (let k = 0; k < n; k += 2) {
          const x = parseFloat(tokens[i++]);
          const yv = parseFloat(tokens[i++]);
          out.push(String(x * scale + tx));
          out.push(String(-yv * scale + ty));
        }
      }
    }
  }
  return out
    .map((t, idx) => (idx > 0 && !/^[a-zA-Z]$/.test(t) && !/^[a-zA-Z]$/.test(out[idx - 1]) ? ',' + t : t))
    .join('');
}
