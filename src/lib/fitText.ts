// Per-tier presets for the multi-line fit. Roboto Flex axis ranges:
// wght 100-1000, wdth 25-151, opsz 8-144. We stay inside those.
export type FitTier = 'primary' | 'secondary' | 'tertiary';

export type FitPreset = {
  fontSize: [min: number, max: number];
  wdth: [min: number, max: number];
  wght: [min: number, max: number];
};

export const PRESETS: Record<FitTier, FitPreset> = {
  primary: { fontSize: [10, 220], wdth: [25, 151], wght: [200, 1000] },
  secondary: { fontSize: [10, 180], wdth: [25, 151], wght: [200, 1000] },
  tertiary: { fontSize: [8, 120], wdth: [25, 151], wght: [200, 1000] },
};

const SLACK_PX = 1; // accept overflow up to 1px to terminate binary search early

// Group tokens so every word ≥3 chars gets its own line; words ≤2 chars
// (e.g. "of", "in", "QR") attach to the next long token, or to the previous
// line if they trail at the end. Equation-y inputs ("(A - λI)v = 0") collapse
// onto a single line because all the short fragments glom together.
export function splitLines(text: string): string[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
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

// Fit a single line span to a target width with the policy:
//   1. Default to the widest + boldest settings.
//   2. Grow size up to sCeil; if width fits at sCeil, line is height-bound — keep it.
//   3. Otherwise binary-search size down until width fits at max wdth/wght.
//   4. If even sMin overflows, reduce wdth, then reduce wght.
function fitLine(el: HTMLElement, cellW: number, maxLineH: number, preset: FitPreset) {
  const [sMin, sMax] = preset.fontSize;
  const [wMin, wMax] = preset.wdth;
  const [gMin, gMax] = preset.wght;
  const sCeil = Math.min(sMax, Math.max(sMin, maxLineH));

  const fitsW = () => el.scrollWidth <= cellW + SLACK_PX;

  // Step 1: try sCeil with widest + boldest. If width fits, we're height-bound.
  applyAxes(el, sCeil, wMax, gMax);
  if (fitsW()) return;

  // Step 2: width overflows at sCeil. Does it fit at sMin?
  applyAxes(el, sMin, wMax, gMax);
  if (fitsW()) {
    const size = searchMax(sMin, sCeil, (s) => {
      applyAxes(el, s, wMax, gMax);
      return fitsW();
    });
    applyAxes(el, size, wMax, gMax);
    return;
  }

  // Step 3: even sMin overflows at max wdth. Reduce wdth at sMin.
  const wdth = searchMax(wMin, wMax, (w) => {
    applyAxes(el, sMin, w, gMax);
    return fitsW();
  });
  applyAxes(el, sMin, wdth, gMax);
  if (fitsW()) return;

  // Step 4: still overflowing. Reduce wght at sMin/wMin.
  const wght = searchMax(gMin, gMax, (g) => {
    applyAxes(el, sMin, wMin, g);
    return fitsW();
  });
  applyAxes(el, sMin, wMin, wght);
  // If still overflowing, the cell's overflow:hidden clips. There's nothing
  // more to give once we're at min size + min wdth + min wght.
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

  const maxLineH = cellH / lines.length;
  const preset = PRESETS[tier];
  for (const line of lines) fitLine(line, cellW, maxLineH, preset);
}

export function clearFit(container: HTMLElement) {
  const lines = Array.from(container.children).filter(
    (c) => c instanceof HTMLElement,
  ) as HTMLElement[];
  for (const line of lines) {
    line.style.fontSize = '';
    line.style.fontVariationSettings = '';
  }
}
