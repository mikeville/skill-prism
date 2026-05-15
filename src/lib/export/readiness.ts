// Prepare the offscreen export subtree for capture.
//
// The live tree's useFitText relies on requestAnimationFrame to schedule its
// fit pass. Browsers throttle/suspend rAFs on hidden documents — and the
// offscreen export host is `position:fixed; left:-99999px`, which doesn't make
// the document hidden, but in some preview/test environments the parent
// document IS hidden, leaving rAF-driven fits stalled.
//
// Rather than wait for fits that may never fire, we invoke fitMultiline
// imperatively here. Each cell's fitRef container is tagged with
// `data-fit-target` plus `data-fit-tier` (the tier to fit at). We just walk
// the targets and call fitMultiline on each. In poster mode this performs the
// fit; in plain mode (`data-fit-mode="plain"`) we skip fitting since plain
// uses static Tailwind sizes — but we still wait for the PrimaryArrows SVG to
// populate, since it has its own RO-driven render and may be empty.

import { fitMultiline, type FitTier } from '../fitText';

const MAX_WAIT_TICKS = 20;
const TICK_MS = 16;

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, TICK_MS));
}

async function waitForFonts(): Promise<void> {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('400 1em "Anybody Variable"'),
      document.fonts.load('900 1em "Anybody Variable"'),
    ]);
    await document.fonts.ready;
  } catch {
    // Worst case the embed step provides the font; don't block capture.
  }
}

function fitAllPosterCells(root: HTMLElement): void {
  const targets = root.querySelectorAll<HTMLElement>(
    '[data-fit-target]:not([data-fit-mode="plain"])',
  );
  for (const el of Array.from(targets)) {
    const tier = (el.dataset.fitTier ?? 'tertiary') as FitTier;
    try {
      fitMultiline(el, tier);
    } catch {
      // Per-cell fit failures shouldn't block the whole capture.
    }
  }
}

async function waitForArrows(root: HTMLElement): Promise<void> {
  // Plain-mode primary cell renders an SVG of arrows. Its sizing fires through
  // a ResizeObserver, which is decoupled from rAF and should be quick. Bail if
  // it hasn't drawn anything after the deadline.
  for (let i = 0; i < MAX_WAIT_TICKS; i++) {
    const svgs = root.querySelectorAll<SVGSVGElement>('svg[data-primary-arrows]');
    if (svgs.length === 0) return;
    let allReady = true;
    for (const svg of Array.from(svgs)) {
      if (svg.querySelectorAll('line').length === 0) {
        allReady = false;
        break;
      }
    }
    if (allReady) return;
    await tick();
  }
}

export async function waitForExportReady(root: HTMLElement): Promise<void> {
  await waitForFonts();

  // Two ticks to let React commit + ResizeObserver populate cellSize state in
  // each Cell. After this, cells know their dimensions and split lines.
  await tick();
  await tick();

  // Imperative fit pass — bypasses the rAF dependency that useFitText would
  // otherwise rely on. Safe to call regardless of mode (plain-mode targets are
  // filtered out via the data-fit-mode attribute).
  fitAllPosterCells(root);
  // Run once more after another tick in case the first pass measured against
  // a cell that hadn't laid out yet.
  await tick();
  fitAllPosterCells(root);

  await waitForArrows(root);
}
