import { hyphenateSync } from 'hyphen/en';

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
// onto a single line because all the short fragments glom together.
//
// Context-aware breaking: long tokens get split at the closest TeX-style
// hyphenation point to the middle of the word (handled by the npm `hyphen`
// package — same algorithm Knuth's TeX uses). The decision to actually
// break is measurement-driven: we predict the resulting fontSize for both
// the intact and broken layouts using a hidden offscreen span and break
// only when broken would meaningfully fill the cell better.
const ABSOLUTE_LONG_THRESHOLD = 16; // always break above this length regardless of cell
const ABSOLUTE_OK_THRESHOLD = 10; // never break at or below this length — short words
//                                  (POLYNOMIAL, etc.) stay intact unconditionally;
//                                  longer words become candidates and the fill criterion
//                                  decides per cell.
const FILL_BENEFIT_RATIO = 1.2; // broken must fill ≥20% more of the cell to justify the
//                                hyphen — so a slightly fuller cell isn't enough; the
//                                gain has to be visible.
const MIN_INTACT_FILL = 0.7; // OR break when intact under-fills this much regardless of
//                              the ratio (a 1-line word that only fills 50% of a tall
//                              cell gets broken even if broken_fill = 0.7).

// ---------- Hyphenation-aware break-point selection ----------
// Pick the hyphenation point closest to the middle of the token. Falls back
// to the midpoint if the word has no hyphenation points (rare for ≥12-char
// English words but possible for compound / coined terms).
function findBreakPosition(token: string): number {
  const lower = token.toLowerCase();
  const SEP = '­'; // soft hyphen — rare in input, safe to use as marker
  let hyphenated: string;
  try {
    hyphenated = hyphenateSync(lower, { hyphenChar: SEP });
  } catch {
    return Math.ceil(token.length / 2);
  }
  const positions: number[] = [];
  let pos = 0;
  for (const ch of hyphenated) {
    if (ch === SEP) positions.push(pos);
    else pos++;
  }
  if (positions.length === 0) return Math.ceil(token.length / 2);
  const mid = token.length / 2;
  let best = positions[0];
  let bestDist = Math.abs(best - mid);
  for (const p of positions) {
    const d = Math.abs(p - mid);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

function breakLongToken(token: string): string {
  const pos = findBreakPosition(token);
  if (pos < 1 || pos >= token.length) return token;
  return token.slice(0, pos) + '-\n' + token.slice(pos);
}

// ---------- Real DOM-measured size prediction ----------
let measureEl: HTMLSpanElement | null = null;
function getMeasureEl(): HTMLSpanElement | null {
  if (typeof document === 'undefined') return null;
  if (!measureEl) {
    measureEl = document.createElement('span');
    measureEl.style.position = 'absolute';
    measureEl.style.left = '-9999px';
    measureEl.style.top = '-9999px';
    measureEl.style.fontFamily = '"Roboto Flex Variable", Inter, sans-serif';
    measureEl.style.whiteSpace = 'nowrap';
    measureEl.style.lineHeight = '1';
    measureEl.style.textTransform = 'uppercase';
    measureEl.style.visibility = 'hidden';
    measureEl.style.pointerEvents = 'none';
    measureEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(measureEl);
  }
  return measureEl;
}

const PROBE_SIZE = 100;
function probeWidth(text: string, wdth: number, wght: number): number {
  const el = getMeasureEl();
  if (!el) return text.length * PROBE_SIZE * 0.18; // SSR fallback
  el.style.fontSize = `${PROBE_SIZE}px`;
  el.style.fontVariationSettings = `"wdth" ${wdth}, "wght" ${wght}, "opsz" ${PROBE_SIZE}`;
  el.textContent = text;
  return el.offsetWidth;
}

// Predict the largest fontSize at which `text` fits within `cellW` at the
// given axes. Linear scaling: width is proportional to fontSize.
function predictMaxSize(text: string, cellW: number, wdth: number, wght: number): number {
  const w = probeWidth(text, wdth, wght);
  if (w <= 0) return PROBE_SIZE;
  return (PROBE_SIZE * cellW) / w;
}

// ---------- Break decision ----------
function fillRatio(fontSize: number, lineCount: number, cellH: number): number {
  return Math.min(1, (lineCount * fontSize * LINE_HEIGHT) / cellH);
}

function shouldBreak(
  token: string,
  cellW: number | undefined,
  cellH: number | undefined,
  lineCount: number,
): boolean {
  const len = token.length;
  if (len <= ABSOLUTE_OK_THRESHOLD) return false;
  if (len > ABSOLUTE_LONG_THRESHOLD) return true;
  if (!cellW || !cellH) return false;

  // Intact prediction: width-bound at min wdth/wght, capped by per-line height.
  const intactWidthBound = predictMaxSize(token, cellW, 25, 200);
  const intactHeightBound = cellH / (lineCount * LINE_HEIGHT);
  const intactSize = Math.min(intactWidthBound, intactHeightBound);
  const intactFill = fillRatio(intactSize, lineCount, cellH);

  // Broken prediction: take the longer half (with trailing hyphen) as the
  // binding chunk, since the shorter half always fits at the same size.
  const pos = findBreakPosition(token);
  const left = token.slice(0, pos);
  const right = token.slice(pos);
  const longer = left.length >= right.length ? `${left}-` : right;
  const brokenWidthBound = predictMaxSize(longer, cellW, 25, 200);
  const brokenHeightBound = cellH / ((lineCount + 1) * LINE_HEIGHT);
  const brokenSize = Math.min(brokenWidthBound, brokenHeightBound);
  const brokenFill = fillRatio(brokenSize, lineCount + 1, cellH);

  // Break if breaking meaningfully fills the cell better, or if intact
  // dramatically under-fills and broken at least matches it.
  if (brokenFill > intactFill * FILL_BENEFIT_RATIO) return true;
  if (intactFill < MIN_INTACT_FILL && brokenFill >= intactFill) return true;
  return false;
}

export function splitLines(text: string, cellW?: number, cellH?: number): string[] {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  // Estimate the line count we'd produce without breaks: each ≥3-char token
  // gets its own line, short tokens attach to neighbours.
  const longTokenCount = tokens.filter((t) => t.length > 2).length;
  const lineCount = Math.max(1, longTokenCount);

  const broken = tokens
    .map((t) => (shouldBreak(t, cellW, cellH, lineCount) ? breakLongToken(t) : t))
    .join(' ');
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
