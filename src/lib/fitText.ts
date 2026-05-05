// Per-tier presets for the multi-line fit. Roboto Flex axis ranges:
// wght 100-1000, wdth 25-151, opsz 8-144. We stay inside those.
export type FitTier = 'primary' | 'secondary' | 'tertiary';

export type FitPreset = {
  fontSize: [min: number, max: number];
  wdth: [min: number, max: number];
  wght: [min: number, max: number];
};

export const PRESETS: Record<FitTier, FitPreset> = {
  primary: { fontSize: [8, 320], wdth: [25, 151], wght: [200, 1000] },
  secondary: { fontSize: [8, 240], wdth: [25, 151], wght: [200, 1000] },
  tertiary: { fontSize: [8, 160], wdth: [25, 151], wght: [200, 1000] },
};

// Line-box-to-fontSize ratio for our caps-only display. Roboto Flex's cap
// height is roughly 0.72em; leading is set to this value via inline style on
// each line span so the line-box is exactly cap-height tall (text flush with
// line-box top/bottom). fontSize is then set to allottedHeight / LINE_HEIGHT
// so that numLines × lineBox === cellHeight, fully consuming vertical space.
export const LINE_HEIGHT = 0.78;

const SLACK_PX = 1; // accept overflow up to 1px to terminate binary search early

// Group tokens so every word ≥3 chars gets its own line; words ≤2 chars
// (e.g. "of", "in", "QR") attach to the next long token, or to the previous
// line if they trail at the end. Equation-y inputs ("(A - λI)v = 0") collapse
// onto a single line because all the short fragments glom together. Genuinely
// extra-long single tokens (>LONG_WORD_THRESHOLD chars) get broken near the
// middle with a hyphen so they can wrap across multiple lines — most ≤14-char
// words stay intact and rely on the wdth axis condensing to fit.
const LONG_WORD_THRESHOLD = 14;

function breakLongToken(token: string): string {
  if (token.length <= LONG_WORD_THRESHOLD) return token;
  // Break near the middle of the token. Bias the first half slightly larger
  // so trailing letters (often suffixes like -TION, -MENT) read cleaner.
  const mid = Math.ceil(token.length / 2);
  return token.slice(0, mid) + '-\n' + token.slice(mid);
}

export function splitLines(text: string): string[] {
  // Pre-split any extra-long single tokens with a hyphen + newline.
  const broken = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(breakLongToken)
    .join(' ');
  // Now respect any embedded line breaks from the long-word splitter.
  return broken
    .split('\n')
    .flatMap((segment) => groupShortTokens(segment.trim()))
    .filter(Boolean);
}

function groupShortTokens(text: string): string[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const lines: string[] = [];
  let buf: string[] = [];
  for (const t of tokens) {
    if (t.length <= 2) {
      buf.push(t);
    } else {
      lines.push(buf.length ? [...buf, t].join(' ') : t);
      buf = [];
    }
  }
  if (buf.length) {
    if (lines.length === 0) lines.push(buf.join(' '));
    else lines[lines.length - 1] = lines[lines.length - 1] + ' ' + buf.join(' ');
  }
  return lines;
}

function applyAxes(el: HTMLElement, fontSize: number, wdth: number, wght: number) {
  el.style.fontSize = `${fontSize}px`;
  el.style.fontVariationSettings = `"wdth" ${wdth}, "wght" ${wght}, "opsz" ${fontSize}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Binary search for the largest value in [lo, hi] for which probe(v) returns true.
// Returns lo if no value in the range fits.
function searchMax(lo: number, hi: number, probe: (v: number) => boolean, iters = 7): number {
  if (lo >= hi) return lo;
  let best = lo;
  let l = lo;
  let h = hi;
  for (let i = 0; i < iters; i++) {
    const mid = (l + h) / 2;
    if (probe(mid)) {
      best = mid;
      l = mid;
    } else {
      h = mid;
    }
  }
  return best;
}

// Fit a single line, prioritizing simultaneous width AND height fill:
//   1. Pick targetSize so the line-box height matches its allotted vertical
//      share (size = allottedH / LINE_HEIGHT — text is then flush with cell
//      top + bottom edges).
//   2. At max wdth + max wght, if width fits, apply letter-spacing to push
//      characters to both horizontal edges. The line span uses
//      text-align: center, and we set a negative margin-inline-end equal to
//      the trailing letter-spacing slot so the visible content centers
//      perfectly while the first/last chars touch the cell edges.
//   3. If width overflows, reduce wdth → wght → size in that order until fit.
function fitLine(el: HTMLElement, cellW: number, allottedH: number, preset: FitPreset) {
  const [sMin, sMax] = preset.fontSize;
  const [wMin, wMax] = preset.wdth;
  const [gMin, gMax] = preset.wght;

  // Reset tracking on every run; lines without slack will stay center-aligned
  // by default (text-align comes from the className) and have no letter-spacing.
  el.style.letterSpacing = '0';
  el.style.textAlign = '';

  const targetSize = clamp(allottedH / LINE_HEIGHT, sMin, sMax);
  const fitsW = () => el.scrollWidth <= cellW + SLACK_PX;

  // Step 1: max wdth/wght at targetSize.
  applyAxes(el, targetSize, wMax, gMax);
  if (fitsW()) {
    applyTracking(el, cellW, targetSize);
    return;
  }

  // Step 2: width overflows at max wdth/wght. Reduce wdth.
  const wdth = searchMax(wMin, wMax, (w) => {
    applyAxes(el, targetSize, w, gMax);
    return fitsW();
  });
  applyAxes(el, targetSize, wdth, gMax);
  if (fitsW()) {
    applyTracking(el, cellW, targetSize);
    return;
  }

  // Step 3: still overflowing. Reduce wght.
  const wght = searchMax(gMin, gMax, (g) => {
    applyAxes(el, targetSize, wMin, g);
    return fitsW();
  });
  applyAxes(el, targetSize, wMin, wght);
  if (fitsW()) {
    applyTracking(el, cellW, targetSize);
    return;
  }

  // Step 4: even at wMin/gMin we overflow. Shrink size below targetSize. The
  // line will under-fill vertically but at least won't get clipped horizontally.
  const newSize = searchMax(sMin, targetSize, (s) => {
    applyAxes(el, s, wMin, gMin);
    return fitsW();
  });
  applyAxes(el, newSize, wMin, gMin);
  // Don't track at this point — the line is already constrained by min axes.
}

// Apply letter-spacing tracking so the line consumes any horizontal slack.
// We spread ls across (charCount - 1) gaps and then switch the line's
// text-align to start so the first char hugs the left edge and the last char
// hugs the right edge — the trailing letter-spacing slot pokes past cellW
// but is clipped by the cell's overflow:hidden, leaving a visually
// edge-to-edge result. Lines without slack stay centered (default).
const MAX_TRACKING_EM = 0.6;
function applyTracking(el: HTMLElement, cellW: number, targetSize: number) {
  const sw0 = el.scrollWidth;
  const slack = cellW - sw0;
  if (slack <= SLACK_PX) return;
  const charCount = (el.textContent || '').length;
  if (charCount < 2) return;
  const ls = clamp(slack / (charCount - 1), 0, MAX_TRACKING_EM * targetSize);
  el.style.letterSpacing = `${ls}px`;
  el.style.textAlign = 'start';
}

export function fitMultiline(container: HTMLElement, tier: FitTier) {
  const lines = Array.from(container.children).filter(
    (c) => c instanceof HTMLElement,
  ) as HTMLElement[];
  if (lines.length === 0) return;

  const cs = window.getComputedStyle(container);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const cellW = container.clientWidth - padX;
  const cellH = container.clientHeight - padY;
  if (cellW < 4 || cellH < 4) return;

  const allottedH = cellH / lines.length;
  const preset = PRESETS[tier];
  for (const line of lines) fitLine(line, cellW, allottedH, preset);
}

export function clearFit(container: HTMLElement) {
  const lines = Array.from(container.children).filter(
    (c) => c instanceof HTMLElement,
  ) as HTMLElement[];
  for (const line of lines) {
    line.style.fontSize = '';
    line.style.fontVariationSettings = '';
    line.style.letterSpacing = '';
    line.style.textAlign = '';
  }
}
