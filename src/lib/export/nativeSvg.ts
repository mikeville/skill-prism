// Walk the already-rendered offscreen ExportCanvas DOM and produce a true
// native SVG — text as <text>, hairlines as <rect>, primary-cell arrows
// re-emitted from their source <svg>. Illustrator / Figma / Inkscape open
// the result as a normal editable vector file.
//
// Strategy: the export tree only contains a handful of meaningful element
// kinds; instead of generically walking every node (which is what dom-to-svg
// does) we hand-pick what to emit. This produces a lean output with no
// stylistic artefacts of the source DOM (no transparent overlay rects, no
// duplicate background fills from intermediate flex wrappers).
//
// Layers, bottom to top:
//   1. Page background fill
//   2. Inter-cell hairlines (the bg-line-meta divs that paint Level borders)
//   3. Perimeter hairlines (the 4 framing lines around the grid)
//   4. Plain-mode primary-cell arrows SVG (cloned)
//   5. Cell text (one <text> per rendered line span)

import { textToPathData, measureTextWidth, getCapHeightFraction } from './textToPath';

const SVG_NS = 'http://www.w3.org/2000/svg';

type Origin = { left: number; top: number };

// Normalize any CSS color string into a form svg2pdf and Illustrator can read.
// Modern Chrome returns `color(srgb r g b)` for CSS `color-mix()` outputs, and
// in Chrome's recent versions canvas2d's fillStyle PRESERVES that notation
// rather than canonicalising to hex — so a plain canvas round-trip is no
// longer enough. We render the color into a 1×1 canvas and read back the
// actual pixel values, which always yields a concrete sRGB triple regardless
// of how the source was specified.
let _colorCtx: CanvasRenderingContext2D | null = null;
function getColorCtx(): CanvasRenderingContext2D | null {
  if (_colorCtx) return _colorCtx;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  _colorCtx = canvas.getContext('2d', { willReadFrequently: true });
  return _colorCtx;
}

function normalizeColor(css: string): string {
  if (!css) return css;
  if (css === 'transparent' || css === 'rgba(0, 0, 0, 0)') return 'transparent';
  const ctx = getColorCtx();
  if (!ctx) return css;
  // Paint the color into a 1×1 pixel and read it back. This avoids every
  // CSS color notation quirk — color(srgb …), lab(), oklch(), etc. — by
  // resolving to actual screen pixels.
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (a === 0) return 'transparent';
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  if (a === 255) return `#${hex(r)}${hex(g)}${hex(b)}`;
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

function parseAxes(fvs: string): { wdth?: number; wght?: number; opsz?: number } {
  // Parse a computed font-variation-settings string like
  // `"opsz" 45, "wdth" 50, "wght" 443.75` into { opsz, wdth, wght }.
  const axes: { wdth?: number; wght?: number; opsz?: number } = {};
  const re = /"(\w+)"\s+([\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fvs)) !== null) {
    const name = m[1] as 'wdth' | 'wght' | 'opsz';
    axes[name] = parseFloat(m[2]);
  }
  return axes;
}

function rect(el: Element, origin: Origin): { x: number; y: number; w: number; h: number } {
  const r = el.getBoundingClientRect();
  return {
    x: r.left - origin.left,
    y: r.top - origin.top,
    w: r.width,
    h: r.height,
  };
}

function emitBackground(root: HTMLElement, w: number, h: number): string {
  const bg = normalizeColor(window.getComputedStyle(root).backgroundColor);
  return `<rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>`;
}

function emitHairlines(root: HTMLElement, origin: Origin): string {
  // Every Level renders its grid with `bg-line-meta` (depth=2 outer frame) or
  // `bg-line-cell` (depth=1 inner frames) on the wrapping <div>, with 1px
  // gap + 1px padding so the background colour shows through the gaps as
  // hairlines. We can't easily recover individual hairlines from gaps, so
  // instead we just render the framing rects with the same bg colour and
  // overlay the cell-fill rects on top. That naturally produces hairlines
  // wherever the cells leave gaps.
  const frames = root.querySelectorAll<HTMLElement>('[class*="bg-line-meta"], [class*="bg-line-cell"]');
  let out = '';
  for (const el of Array.from(frames)) {
    const cs = window.getComputedStyle(el);
    const bg = normalizeColor(cs.backgroundColor);
    if (bg === 'transparent') continue;
    const r = rect(el, origin);
    out += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${bg}"/>`;
  }
  return out;
}

function emitCellFills(root: HTMLElement, origin: Origin): string {
  // The cells use `bg-paper` (same as page background). They paint over the
  // dark frame rects emitted by emitHairlines, leaving the 1px gaps visible
  // as hairlines. Each Cell renders as a <div> with the bg-paper class.
  const cells = root.querySelectorAll<HTMLElement>('[class*="bg-paper"]');
  let out = '';
  for (const el of Array.from(cells)) {
    // Skip the outermost ExportCanvas root — it's already the page background.
    if (el === root) continue;
    const cs = window.getComputedStyle(el);
    const bg = normalizeColor(cs.backgroundColor);
    if (bg === 'transparent') continue;
    const r = rect(el, origin);
    out += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${bg}"/>`;
  }
  return out;
}

function emitPerimeterLines(root: HTMLElement, origin: Origin): string {
  // ExportCanvas paints 4 perimeter hairlines as absolutely positioned divs
  // with bg-line-meta and a 1px width or height. Same handling as the cell
  // frames — emit a rect.
  // (Already covered by emitHairlines since they have bg-line-meta. This is
  // a no-op left here for clarity.)
  void root;
  void origin;
  return '';
}

function emitPrimaryArrows(root: HTMLElement, origin: Origin): string {
  // Plain-mode primary cell contains an inline SVG with stroke="currentColor"
  // arrows. Re-emit each line element at SVG-document coordinates, replacing
  // currentColor with the cell's actual computed color.
  const svgs = root.querySelectorAll<SVGSVGElement>('svg[data-primary-arrows]');
  let out = '';
  for (const svg of Array.from(svgs)) {
    const svgRect = rect(svg, origin);
    const cellColor = normalizeColor(window.getComputedStyle(svg.parentElement!.parentElement!).color);
    // The arrows use pixel-coordinate viewBox matching the cell. Translate
    // line coords into document space.
    const lines = svg.querySelectorAll('line');
    for (const line of Array.from(lines)) {
      const x1 = parseFloat(line.getAttribute('x1') ?? '0') + svgRect.x;
      const y1 = parseFloat(line.getAttribute('y1') ?? '0') + svgRect.y;
      const x2 = parseFloat(line.getAttribute('x2') ?? '0') + svgRect.x;
      const y2 = parseFloat(line.getAttribute('y2') ?? '0') + svgRect.y;
      out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${cellColor}" stroke-width="1.25" stroke-linecap="butt" marker-end="url(#primary-arrowhead)"/>`;
    }
  }
  // Define the shared arrowhead marker once.
  if (out) {
    const cellColor = (() => {
      const s = root.querySelector<SVGSVGElement>('svg[data-primary-arrows]');
      return s
        ? normalizeColor(window.getComputedStyle(s.parentElement!.parentElement!).color)
        : 'currentColor';
    })();
    out =
      `<defs><marker id="primary-arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L10,5 L0,10 z" fill="${cellColor}"/></marker></defs>` +
      out;
  }
  return out;
}

async function emitOutlinedText(root: HTMLElement, origin: Origin): Promise<string> {
  // Walk each fit target, collect text runs, then outline each run to a path
  // using fontkit. Outlining decouples the SVG from any installed-font
  // dependency at open time — Illustrator and friends just see filled shapes.
  //
  // Baseline placement uses the font's own capHeight metric rather than the
  // DOM line's bounding rect. The DOM rect is shaped by `text-box-trim` /
  // `text-box-edge`, which Illustrator doesn't replicate; using the font
  // metric pins the cap-top of each line exactly at the line's top edge so
  // leading matches across renderers.
  const capHeightFrac = await getCapHeightFraction();
  const targets = root.querySelectorAll<HTMLElement>('[data-fit-target]');
  const runs: Array<{
    text: string;
    x: number;
    y: number;
    fontSize: number;
    axes: { wdth?: number; wght?: number; opsz?: number };
    letterSpacingPx: number;
    color: string;
  }> = [];

  for (const target of Array.from(targets)) {
    const lines = Array.from(target.children) as HTMLElement[];
    for (const line of lines) {
      const text = (line.textContent ?? '').trim().toUpperCase();
      if (!text) continue;
      const r = rect(line, origin);
      const cs = window.getComputedStyle(line);
      const fontSize = parseFloat(cs.fontSize);
      const letterSpacingPx =
        cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0;
      const color = normalizeColor(cs.color);
      const axes = parseAxes(cs.fontVariationSettings);
      const textAlign = cs.textAlign;

      // Horizontal: opentype/fontkit lay out from the start x. Center/right
      // alignment is computed against the actual rendered advance width.
      let x = r.x;
      const advance = await measureTextWidth(text, fontSize, axes, letterSpacingPx);
      if (textAlign === 'center' || textAlign === '' || textAlign === 'normal') {
        x = r.x + r.w / 2 - advance / 2;
      } else if (textAlign === 'end' || textAlign === 'right') {
        x = r.x + r.w - advance;
      }

      // Vertical: baseline = top of line + capHeight (in px). The cap-top
      // therefore sits at r.y, the visual top edge of the DOM line. Stacked
      // lines naturally inherit the DOM's leading from the line-rect
      // positions, with each line's caps anchored to its own top edge.
      const y = r.y + fontSize * capHeightFrac;

      runs.push({ text, x, y, fontSize, axes, letterSpacingPx, color });
    }
  }

  const paths = await Promise.all(
    runs.map(async (run) => {
      const d = await textToPathData(
        run.text,
        run.x,
        run.y,
        run.fontSize,
        run.axes,
        run.letterSpacingPx,
      );
      return `<path d='${d}' fill='${run.color}'/>`;
    }),
  );

  return paths.join('');
}

export async function buildNativeSvg(
  root: HTMLElement,
  width: number,
  height: number,
): Promise<string> {
  const r = root.getBoundingClientRect();
  const origin: Origin = { left: r.left, top: r.top };

  const bg = emitBackground(root, width, height);
  const frames = emitHairlines(root, origin);
  const fills = emitCellFills(root, origin);
  const perim = emitPerimeterLines(root, origin);
  const arrows = emitPrimaryArrows(root, origin);
  // Text is outlined to paths via opentype.js — no @font-face needed; the
  // output is self-contained and font-agnostic. Live text is gone, but the
  // file opens reliably in every vector tool and on every machine.
  const text = await emitOutlinedText(root, origin);

  return (
    `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    bg +
    frames +
    fills +
    perim +
    arrows +
    text +
    `</svg>`
  );
}
