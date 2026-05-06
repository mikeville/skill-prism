import { hyphenateSync } from 'hyphen/en';
import { getActiveFont } from './fontConfig';

// Per-tier presets for the multi-line fit. Axis ranges come from the active
// FontConfig so swapping typefaces at runtime affects every subsequent fit.
export type FitTier = 'primary' | 'secondary' | 'tertiary';

export type FitPreset = {
  fontSize: [min: number, max: number];
  wdth: [min: number, max: number];
  wght: [min: number, max: number];
};

// fontSize upper bounds are tier-specific (presentation concern); the lower
// bound tracks the font's opsz minimum so we never request a size below what
// the font is hinted for. wdth/wght bounds come straight from the config.
const SIZE_MAX_BY_TIER: Record<FitTier, number> = {
  primary: 320,
  secondary: 240,
  tertiary: 160,
};

export function getPreset(tier: FitTier): FitPreset {
  const cfg = getActiveFont();
  const sMin = cfg.axes.opsz[0];
  return {
    fontSize: [sMin, SIZE_MAX_BY_TIER[tier]],
    wdth: cfg.axes.wdth,
    wght: cfg.axes.wght,
  };
}

// Line-box-to-fontSize ratio for our caps-only display. Roughly matches the
// font's cap height so leading produces line-boxes exactly cap-height tall
// (text flush with line-box top/bottom). fontSize is then set to
// allottedHeight / lineHeight so numLines × lineBox === cellHeight.
export function getLineHeight(): number {
  return getActiveFont().lineHeight;
}

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
// Pick the hyphenation point closest to the middle of the token. TeX patterns
// handle most compound words well (POWER-LIFTING, BODY-BUILDING, BROAD-CASTING)
// because the patterns recognize multiple syllable boundaries. But some words
// — most notably WEIGHTLIFTING — are stored in the TeX dictionary with a
// single explicit hyphenation (`weightlift-ing`) that puts a tiny suffix on
// one side. When that happens we treat the result as suspicious and reach
// for a syllable-aware midpoint break instead of accepting the lopsided one.
const SHORT_SUFFIX_LEN = 3; // ≤ this many chars on the right is "suspicious"
const LONG_PREFIX_LEN = 7; // and ≥ this many chars on the left means we should
//                           try harder for a balanced break (the long stem
//                           probably hides a compound-word boundary)

const COMMON_CONSONANT_CLUSTERS = new Set([
  // English word-initial consonant pairs that read naturally.
  'br', 'bl', 'ch', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr',
  'pl', 'pr', 'sc', 'sh', 'sk', 'sl', 'sm', 'sn', 'sp', 'st',
  'sw', 'th', 'tr', 'tw', 'wh', 'wr', 'ph', 'qu',
]);

function isVowel(c: string): boolean {
  return 'aeiouy'.includes(c);
}

// Score how natural it would be for an English word to START with this
// string. We score V starts (e.g. "ization", "ites") and CV starts (e.g.
// "lift", "tion") and common CC starts (e.g. "stop", "blanket") as fully
// natural; only awkward consonant clusters ("tl", "ft", "mb") get penalized.
function scoreStart(s: string): number {
  if (s.length === 0) return 0;
  if (s.length === 1) return 2;
  const c1 = s[0];
  const c2 = s[1];
  if (isVowel(c1)) return 2; // V start (still natural, but slightly weaker
  //                            cue than CV — many English words start with
  //                            a consonant)
  if (isVowel(c2)) return 3; // CV start
  if (COMMON_CONSONANT_CLUSTERS.has(c1 + c2)) return 3; // common CC start
  return 0; // unnatural CC start (e.g., "tl", "ft", "mb")
}

// Score how natural it would be for an English word to END at this position.
// Consonant-final prefixes feel more like complete chunks than vowel-final.
function scoreEnd(s: string): number {
  if (s.length < 2) return 0;
  return isVowel(s[s.length - 1]) ? 1 : 2;
}

// Score a candidate break position. Higher = better.
//   startScore × 2 — start quality dominates (a natural-looking second-half
//                     onset is more important than millimetres of balance).
//   endScore — small bonus for consonant-final prefixes.
//   −|p − mid| — penalize positions far from the centre.
// The factor is intentionally low (×2 not ×10) so a moderately better start
// doesn't outweigh a much more balanced split.
function scoreBreakPosition(word: string, p: number): number {
  const startScore = scoreStart(word.slice(p));
  const endScore = scoreEnd(word.slice(0, p));
  const distPenalty = Math.abs(p - word.length / 2);
  return startScore * 2 + endScore - distPenalty;
}

function pickBestPosition(word: string, positions: number[]): number {
  let best = positions[0];
  let bestScore = scoreBreakPosition(word, best);
  for (const p of positions) {
    const score = scoreBreakPosition(word, p);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

// Refinement search: enumerate positions ±3 around the centre and pick the
// best by the same scoring function. Used as a fallback when TeX patterns
// give an unusable result (no breaks at all, or a single short-suffix break
// on a long stem — i.e. an unrecognized compound word like WEIGHTLIFTING).
function findSyllableMidpointBreak(word: string): number {
  const len = word.length;
  const mid = len / 2;
  const lo = Math.max(2, Math.floor(mid) - 3);
  const hi = Math.min(len - 2, Math.ceil(mid) + 3);
  const candidates: number[] = [];
  for (let p = lo; p <= hi; p++) candidates.push(p);
  if (candidates.length === 0) return Math.ceil(mid);
  return pickBestPosition(word, candidates);
}

function findBreakPosition(token: string): number {
  const lower = token.toLowerCase();
  const SEP = '­'; // soft hyphen — rare in input, safe to use as marker
  let hyphenated: string;
  try {
    hyphenated = hyphenateSync(lower, { hyphenChar: SEP });
  } catch {
    return findSyllableMidpointBreak(lower);
  }
  const positions: number[] = [];
  let pos = 0;
  for (const ch of hyphenated) {
    if (ch === SEP) positions.push(pos);
    else pos++;
  }
  if (positions.length === 0) return findSyllableMidpointBreak(lower);

  const best = pickBestPosition(lower, positions);

  // Suspicious-result refinement: when the only sensible TeX point creates a
  // very short suffix on a long stem, the dictionary likely missed a compound
  // boundary (e.g. WEIGHTLIFTING → weightlift-ing). Re-search via the
  // syllable heuristic, which does find the WEIGHT-LIFTING break.
  const suffixLen = token.length - best;
  const prefixLen = best;
  if (suffixLen <= SHORT_SUFFIX_LEN && prefixLen >= LONG_PREFIX_LEN) {
    return findSyllableMidpointBreak(lower);
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
    measureEl.style.whiteSpace = 'nowrap';
    measureEl.style.lineHeight = '1';
    measureEl.style.textTransform = 'uppercase';
    measureEl.style.visibility = 'hidden';
    measureEl.style.pointerEvents = 'none';
    measureEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(measureEl);
  }
  // Refresh font-family on every read so probes use the active typeface.
  measureEl.style.fontFamily = getActiveFont().family;
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
function fillRatio(fontSize: number, lineCount: number, cellH: number, lineH: number): number {
  return Math.min(1, (lineCount * fontSize * lineH) / cellH);
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

  const cfg = getActiveFont();
  const lineH = cfg.lineHeight;

  // Intact prediction: width-bound at min wdth/wght, capped by per-line height.
  const wMin = cfg.axes.wdth[0];
  const gMin = cfg.axes.wght[0];
  const intactWidthBound = predictMaxSize(token, cellW, wMin, gMin);
  const intactHeightBound = cellH / (lineCount * lineH);
  const intactSize = Math.min(intactWidthBound, intactHeightBound);
  const intactFill = fillRatio(intactSize, lineCount, cellH, lineH);

  // Broken prediction: take the longer half (with trailing hyphen) as the
  // binding chunk, since the shorter half always fits at the same size.
  const pos = findBreakPosition(token);
  const left = token.slice(0, pos);
  const right = token.slice(pos);
  const longer = left.length >= right.length ? `${left}-` : right;
  const brokenWidthBound = predictMaxSize(longer, cellW, wMin, gMin);
  const brokenHeightBound = cellH / ((lineCount + 1) * lineH);
  const brokenSize = Math.min(brokenWidthBound, brokenHeightBound);
  const brokenFill = fillRatio(brokenSize, lineCount + 1, cellH, lineH);

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
//      share (size = allottedH / lineHeight — text is then flush with cell
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

  const targetSize = clamp(allottedH / getActiveFont().lineHeight, sMin, sMax);
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
// We spread ls across (charCount - 1) gaps and switch the line's text-align
// to start so the first char hugs the left edge and the last char hugs the
// right edge. The trailing letter-spacing slot pokes past cellW but is
// clipped by the cell's overflow:hidden, leaving a visually edge-to-edge
// result regardless of how much slack there is. No cap on tracking — short
// words in wide cells deliberately get large gaps so the first/last
// characters always sit flush with the cell edges (the poster aesthetic).
// Lines without slack stay centered (default).
//
// IMPORTANT: we measure natural text width via Range, not el.scrollWidth.
// The line span uses `display: block; width: 100%` for layout, which makes
// scrollWidth report the parent's width (≈ cellW) regardless of how much
// shorter the actual text is. Range.getBoundingClientRect() bypasses that
// and returns the real rendered text width.
function naturalTextWidth(el: HTMLElement): number {
  if (typeof document === 'undefined' || !document.createRange) {
    return el.scrollWidth;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  const rect = range.getBoundingClientRect();
  range.detach?.();
  return rect.width;
}

function applyTracking(el: HTMLElement, cellW: number, _targetSize: number) {
  const charCount = (el.textContent || '').length;
  if (charCount < 2) return;
  const naturalW = naturalTextWidth(el);
  const slack = cellW - naturalW;
  if (slack <= SLACK_PX) return;
  const ls = slack / (charCount - 1);
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
  const preset = getPreset(tier);
  for (const line of lines) fitLine(line, cellW, allottedH, preset);
}

export function clearFit(container: HTMLElement) {
  const lines = Array.from(container.children).filter(
    (c) => c instanceof HTMLElement,
  ) as HTMLElement[];
  for (const line of lines) {
    line.style.fontSize = '';
    line.style.letterSpacing = '';
    line.style.textAlign = '';
    // Don't clear fontVariationSettings — plain mode owns this property via
    // its own inline style and React only updates it on the next commit, so
    // clearing here would erase plain's static axis settings on toggle.
  }
}
