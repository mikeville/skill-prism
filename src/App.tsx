import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EmptyState, type FirstRect } from './components/EmptyState/EmptyState';
import { FractalView } from './components/FractalView/FractalView';
import type { CellClick } from './components/FractalView/Level';
import type { ZoomIntent } from './components/FractalView/FractalView';
import { InsightDrawer } from './components/Insight/InsightDrawer';
import { InsightPanel } from './components/Insight/InsightPanel';
import { Breadcrumb } from './components/Topbar/Breadcrumb';
import { Topbar } from './components/Topbar/Topbar';
import { ColorThemeProvider, useColorTheme } from './contexts/ColorTheme';
import { TypeModeProvider } from './contexts/TypeMode';
import { useBreakdown } from './hooks/useBreakdown';
import { useContainerDepth } from './hooks/useContainerDepth';
import { usePath } from './hooks/usePath';
import { cacheGet } from './lib/cache';

// TODO: dormant scaffolding — components/SkillSidebar/ and lib/exportSkill.ts
// are implemented but not wired into the UI. Either wire them up (open the
// sidebar from a Topbar button and feed it buildSkillMarkdown(path, data))
// or delete them. Don't leave them indefinitely.

const AdminPage = lazy(() =>
  import('./components/Admin/AdminPage').then((m) => ({ default: m.AdminPage })),
);

export default function App() {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-sm text-neutral-500">
            Loading admin…
          </div>
        }
      >
        <AdminPage />
      </Suspense>
    );
  }
  return (
    <ColorThemeProvider>
      <TypeModeProvider>
        <AppInner />
      </TypeModeProvider>
    </ColorThemeProvider>
  );
}

// All cells (corner + 3×3 + 9×9) share the viewport's aspect ratio when the
// layout is full-bleed: corner_w / corner_h = V_w / V_h falls out of the geometry.
// Track viewport aspect and expose it as --inner-aspect for corner widths.
function useViewportAspect() {
  useEffect(() => {
    const update = () => {
      document.documentElement.style.setProperty(
        '--inner-aspect',
        String(window.innerWidth / window.innerHeight),
      );
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
}

const MORPH_MS = 360;
const MORPH_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

function AppInner() {
  const [path, setPath] = usePath();
  const { data, error } = useBreakdown(path);
  const { ref: gridContainerRef, depth } = useContainerDepth();
  useViewportAspect();
  const { randomize: randomizeColor } = useColorTheme();
  const zoomIntent = useRef<ZoomIntent | null>(null);
  const prevPathLengthRef = useRef(0);

  // FLIP source rect: the empty-state input wrapper's bounding box at submit
  // time. Captured synchronously inside EmptyState's submit handler before
  // setPath runs so the wrapper is still mounted.
  const morphFirstRectRef = useRef<FirstRect | null>(null);
  // FLIP target ref: the depth=2 primary cell (desktop) or depth=1 standalone
  // outer frame (mobile). Set by Cell/Level via callback ref on mount.
  const primaryCellRef = useRef<HTMLDivElement | null>(null);
  // Mirror the ref into state so the mobile lattice effect re-runs when the
  // primary cell node mounts/unmounts (raw refs don't trigger re-renders).
  const [primaryCellEl, setPrimaryCellEl] = useState<HTMLDivElement | null>(null);
  const setPrimaryCellRef = useCallback((el: HTMLDivElement | null) => {
    primaryCellRef.current = el;
    setPrimaryCellEl(el);
  }, []);

  // Mobile-only lattice: the 3×3 grid's row/col divider positions, extended
  // viewport-wide so the grid reads as part of a larger visual lattice rather
  // than a floating box. We measure the standalone grid frame (which IS the
  // primary cell ref target on mobile) and re-render the lines on resize.
  type LatticeRect = { left: number; top: number; width: number; height: number };
  const [latticeRect, setLatticeRect] = useState<LatticeRect | null>(null);
  useEffect(() => {
    if (!primaryCellEl || depth !== 1) {
      setLatticeRect(null);
      return;
    }
    const update = () => {
      const r = primaryCellEl.getBoundingClientRect();
      setLatticeRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(primaryCellEl);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [primaryCellEl, depth]);

  const inEmpty = path.length === 0;
  const isMobile = depth === 1;

  const handleSubmit = (topic: string, firstRect: FirstRect | null) => {
    morphFirstRectRef.current = firstRect;
    zoomIntent.current = null;
    // Each new search reveals a new palette. Drill-down clicks and manual
    // picker selections don't trigger this; only fresh searches and initial
    // empty-state page loads (handled in ColorTheme readInitialSet).
    randomizeColor();
    setPath([topic]);
  };

  // Empty → active: run the FLIP morph on the new primary cell so it appears
  // at the input wrapper's old position, then animates into its grid slot.
  // Coordinated with perimeter fade-in and primary-cell text fade-in (queried
  // by data-perimeter and selectors inside the cell).
  useLayoutEffect(() => {
    const wasEmpty = prevPathLengthRef.current === 0;
    prevPathLengthRef.current = path.length;
    if (!wasEmpty || path.length === 0) return;

    const first = morphFirstRectRef.current;
    morphFirstRectRef.current = null;
    const target = primaryCellRef.current;
    if (!first || !target) return;

    const last = target.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = last.width === 0 ? 1 : first.width / last.width;
    const sy = last.height === 0 ? 1 : first.height / last.height;

    // Box: FLIP from (first) back to (last) using transform.
    const boxAnim = target.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          transformOrigin: 'top left',
        },
        {
          transform: 'translate(0, 0) scale(1, 1)',
          transformOrigin: 'top left',
        },
      ],
      { duration: MORPH_MS, easing: MORPH_EASE, fill: 'backwards' },
    );

    // Primary cell content (the topic text): the empty state had only a
    // placeholder so the swap is otherwise jarring. Fade content in over the
    // first half of the morph so the user reads "input → text inside the same
    // box," not "input → small topic → grown topic."
    const contentEls = Array.from(target.children) as HTMLElement[];
    const contentAnims = contentEls.map((el) =>
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: MORPH_MS / 2,
        easing: MORPH_EASE,
        fill: 'backwards',
      }),
    );

    // Perimeter blocks: fade in around the primary cell. Slight delay so the
    // box has visibly started morphing first — reinforces "this IS the cell;
    // the rest is context appearing around it."
    const perimeterEls = document.querySelectorAll<HTMLElement>('[data-perimeter]');
    const perimeterAnims = Array.from(perimeterEls).map((el) =>
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: MORPH_MS - 80,
        delay: 80,
        easing: MORPH_EASE,
        fill: 'backwards',
      }),
    );

    return () => {
      boxAnim.cancel();
      contentAnims.forEach((a) => a.cancel());
      perimeterAnims.forEach((a) => a.cancel());
    };
  }, [path]);

  const handleCellClick = (c: CellClick) => {
    if (!data) return;
    const next =
      c.kind === 'tertiary'
        ? [...path, data.mains[c.mainIdx], data.subs[c.mainIdx][c.subIdx]]
        : [...path, data.mains[c.mainIdx]];
    setPath(next);
  };

  const handleJump = (idx: number) => {
    if (idx >= path.length - 1) return;
    const newPath = path.slice(0, idx + 1);
    const targetTerm = path[idx + 1];
    const parentBreakdown = cacheGet(newPath);
    const mainsIdx = parentBreakdown ? parentBreakdown.mains.indexOf(targetTerm) : -1;
    zoomIntent.current = mainsIdx >= 0 ? { kind: 'out', mainsIdx } : null;
    setPath(newPath);
  };

  const handleReset = () => {
    zoomIntent.current = null;
    setPath([]);
  };

  // "Now what?" payoff state. Desktop: drawer for any clicked cell's term.
  // Mobile: a bottom panel below renders insight for the focal term directly
  // from `path`, no per-cell trigger.
  const [insightTarget, setInsightTarget] = useState<{
    path: string[];
    term: string;
  } | null>(null);
  const handleInsightClick = useCallback(
    (term: string) => {
      // If the term IS the focal, treat the parent breadcrumb as context;
      // otherwise the user is asking about a sibling/sub of the focal, so the
      // current path is itself the context that led them there.
      const isFocal = path.length > 0 && term === path[path.length - 1];
      const parentPath = isFocal ? path.slice(0, -1) : path;
      setInsightTarget({ path: parentPath, term });
    },
    [path],
  );
  const closeInsight = useCallback(() => setInsightTarget(null), []);

  return (
    <div className="fixed inset-0 bg-paper text-ink overflow-hidden">
      {inEmpty && <EmptyState onSubmit={handleSubmit} />}
      {!inEmpty && (
        <div ref={gridContainerRef} className="absolute inset-0 flex flex-col">
          {/* Desktop perimeter: top/bottom horizontals frame the FractalView's
              padded area. Hidden on mobile because the new lattice (below)
              draws lines at the grid's own top/bottom frame positions instead,
              which leaves the topbar/breadcrumb area open. */}
          {!isMobile && (
            <>
              <div
                aria-hidden
                data-perimeter
                className="absolute left-0 right-0 h-px bg-line-meta pointer-events-none z-10"
                style={{ top: 'clamp(48px, 6vmin, 72px)' }}
              />
              <div
                aria-hidden
                data-perimeter
                className="absolute left-0 right-0 h-px bg-line-meta pointer-events-none z-10"
                style={{ bottom: 'clamp(48px, 6vmin, 72px)' }}
              />
            </>
          )}
          <div
            aria-hidden
            data-perimeter
            className="absolute top-0 bottom-0 w-px bg-line-meta pointer-events-none z-10"
            style={{ left: 'calc(clamp(48px, 6vmin, 72px) * var(--inner-aspect, 1))' }}
          />
          <div
            aria-hidden
            data-perimeter
            className="absolute top-0 bottom-0 w-px bg-line-meta pointer-events-none z-10"
            style={{ right: 'calc(clamp(48px, 6vmin, 72px) * var(--inner-aspect, 1))' }}
          />
          {/* Mobile lattice: only the OUTER edges of the 3×3 are extended out
              past the grid frame into the surrounding margin. Inner column/
              row dividers stay contained within the grid. The existing left/
              right perimeter verticals above already coincide with the grid's
              left/right frame, so the only new lines we add here are the
              extended top and bottom edges. */}
          {isMobile && latticeRect && (
            <>
              <div
                aria-hidden
                data-perimeter
                className="absolute left-0 right-0 h-px bg-line-meta pointer-events-none z-10"
                style={{ top: latticeRect.top }}
              />
              <div
                aria-hidden
                data-perimeter
                className="absolute left-0 right-0 h-px bg-line-meta pointer-events-none z-10"
                style={{ top: latticeRect.top + latticeRect.height - 1 }}
              />
            </>
          )}
          {/* Mobile-only breadcrumb row: sits just above the grid's top edge.
              Bottom-aligned (not centered) within the gap so it visually
              anchors to the top grid line, with a small breathing gap above
              the line. On desktop the breadcrumb still lives inside the
              Topbar's center column. */}
          {isMobile && path.length >= 2 && latticeRect && (
            <div
              data-perimeter
              className="absolute left-0 right-0 z-20 flex items-end justify-center text-meta font-meta pb-3"
              style={{
                top: 'clamp(48px, 6vmin, 72px)',
                height: `calc(${latticeRect.top}px - clamp(48px, 6vmin, 72px))`,
                paddingLeft: 'calc(clamp(48px, 6vmin, 72px) * var(--inner-aspect, 1) + 1rem)',
                paddingRight: 'calc(clamp(48px, 6vmin, 72px) * var(--inner-aspect, 1) + 1rem)',
              }}
            >
              <Breadcrumb path={path} onJump={handleJump} allInk />
            </div>
          )}
          <div data-perimeter>
            <Topbar
              path={path}
              onJump={handleJump}
              onReset={handleReset}
              data={data}
              hideBreadcrumb={isMobile}
            />
          </div>
          <div className="relative flex-1 min-h-0">
            <FractalView
              data={data}
              depth={depth}
              onCellClick={handleCellClick}
              onInsightClick={isMobile ? undefined : handleInsightClick}
              zoomIntent={zoomIntent}
              primaryRef={setPrimaryCellRef}
            />
            {error && (
              <div className="absolute bottom-4 left-8 bg-paper border-cell border-ink px-2 py-1 text-meta font-meta">
                {error}
              </div>
            )}
          </div>
          {/* Desktop drawer — per-cell insight on demand. */}
          {!isMobile && (
            <InsightDrawer
              open={insightTarget !== null}
              onClose={closeInsight}
              path={insightTarget?.path ?? []}
              term={insightTarget?.term ?? null}
            />
          )}
          {/* Mobile panel — always-visible, locked to the focal term. */}
          {isMobile && <InsightPanel path={path} />}
        </div>
      )}
    </div>
  );
}
