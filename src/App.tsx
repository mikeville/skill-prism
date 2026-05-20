import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EmptyState, type FirstRect } from './components/EmptyState/EmptyState';
import { ExportPanel } from './components/Export/ExportPanel';
import { FractalView } from './components/FractalView/FractalView';
import type { CellClick } from './components/FractalView/Level';
import type { ZoomIntent } from './components/FractalView/FractalView';
import { InsightPane } from './components/Insight/InsightPane';
import { Breadcrumb } from './components/Topbar/Breadcrumb';
import { Topbar } from './components/Topbar/Topbar';
import { ColorThemeProvider, useColorTheme } from './contexts/ColorTheme';
import { TypeModeProvider } from './contexts/TypeMode';
import { useBreakdown } from './hooks/useBreakdown';
import { usePath } from './hooks/usePath';
import { cacheGet } from './lib/cache';

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

// Track the viewport's aspect ratio in a CSS variable so the desktop macro
// grid's left/right corner columns can be sized `clamp × aspect`. This is
// what makes the four macro-grid corner cells stay visually proportional to
// the viewport as the user resizes the browser — the same "page margins
// follow the viewport" trick the original implementation had.
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
const WIDE_LAYOUT_PX = 1024;

function useIsWideLayout(): boolean {
  const get = () => typeof window !== 'undefined' && window.innerWidth >= WIDE_LAYOUT_PX;
  const [wide, setWide] = useState<boolean>(get);
  useEffect(() => {
    const update = () => setWide(get());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return wide;
}

// Page-grid template values. Desktop uses the `clamp × aspect` trick on
// columns so the four page-grid corner cells stay viewport-proportional;
// mobile uses a smaller fixed clamp because the user explicitly opted out of
// the proportional treatment for the narrow viewport.
const PAGE_CORNER_CLAMP = 'clamp(48px, 6vmin, 72px)';
const DESKTOP_GRID_ROWS = `${PAGE_CORNER_CLAMP} 1fr ${PAGE_CORNER_CLAMP}`;
const DESKTOP_CORNER_COL = `calc(${PAGE_CORNER_CLAMP} * var(--inner-aspect, 1))`;
const MOBILE_GRID_ROWS = 'auto auto auto';
const MOBILE_GRID_COLS = 'clamp(16px, 3vmin, 24px) 1fr clamp(16px, 3vmin, 24px)';

const INFO_PANEL_OPEN_PX = 420;
const PANEL_ANIM_MS = 240;
const PANEL_ANIM_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

function AppInner() {
  const [path, setPath] = usePath();
  const { data, error } = useBreakdown(path);
  useViewportAspect();
  const { randomize: randomizeColor } = useColorTheme();
  const zoomIntent = useRef<ZoomIntent | null>(null);
  const prevPathLengthRef = useRef(0);

  const morphFirstRectRef = useRef<FirstRect | null>(null);
  const primaryCellRef = useRef<HTMLDivElement | null>(null);
  const setPrimaryCellRef = useCallback((el: HTMLDivElement | null) => {
    primaryCellRef.current = el;
  }, []);

  const inEmpty = path.length === 0;
  const isWide = useIsWideLayout();

  // Desktop sidebar collapse state. Open by default. Toggled from a Topbar
  // icon and from a CLOSE button inside the pane. State preserved across
  // drills. When closed, the macro 3×3 grid takes the full viewport.
  const [asideOpen, setAsideOpen] = useState<boolean>(true);
  const toggleAside = useCallback(() => setAsideOpen((v) => !v), []);
  const closeAside = useCallback(() => setAsideOpen(false), []);

  // Desktop export-panel state. When true, the info-panel slot renders the
  // ExportPanel form in place of the InsightPane. Opening export forces the
  // sidebar open so the controls have room to land; closing returns to the
  // insight view without changing aside open/closed state.
  const [exportOpen, setExportOpen] = useState<boolean>(false);
  const openExport = useCallback(() => {
    setExportOpen(true);
    setAsideOpen(true);
  }, []);
  const closeExport = useCallback(() => setExportOpen(false), []);

  // "Pinned" insight target: clicking the "i" icon on a non-focal cell scopes
  // the desktop sidebar to that cell's term. Cleared on path change so
  // subsequent drilling reverts the sidebar to the new focal.
  const [pinnedTerm, setPinnedTerm] = useState<string | null>(null);
  useEffect(() => {
    setPinnedTerm(null);
  }, [JSON.stringify(path)]);
  const handleInsightClick = useCallback((term: string) => {
    setPinnedTerm(term);
    setAsideOpen(true);
  }, []);

  const focalTerm = path[path.length - 1] ?? '';
  const insightTerm = pinnedTerm ?? focalTerm;
  const insightContextPath = pinnedTerm ? path : path.slice(0, -1);

  const handleSubmit = (topic: string, firstRect: FirstRect | null) => {
    morphFirstRectRef.current = firstRect;
    zoomIntent.current = null;
    randomizeColor();
    setPath([topic]);
  };

  // Empty → active morph (FLIP). Runs on the first transition out of empty
  // state. The morph target is whatever cell carries `primaryRef` —
  // depth=2's primary cell on desktop or the depth=1 standalone outer frame
  // on mobile.
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

    const contentEls = Array.from(target.children) as HTMLElement[];
    const contentAnims = contentEls.map((el) =>
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: MORPH_MS / 2,
        easing: MORPH_EASE,
        fill: 'backwards',
      }),
    );

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

  // ─── Empty state ────────────────────────────────────────────────────────
  if (inEmpty) {
    return (
      <div className="fixed inset-0 bg-paper text-ink overflow-hidden">
        <EmptyState onSubmit={handleSubmit} />
      </div>
    );
  }

  // ─── Mobile: macro 3×3 grid as a scrollable page. Top row is sticky. ──
  if (!isWide) {
    return (
      <div
        className="min-h-screen bg-line-meta text-ink grid gap-px"
        style={{
          gridTemplateColumns: MOBILE_GRID_COLS,
          gridTemplateRows: MOBILE_GRID_ROWS,
        }}
      >
        {/* Top row — sticky so the header stays as content scrolls under it.
            box-shadow occupies the same 1-pixel slot as the macro grid's
            row gap below the top row, so at scroll=0 it overlaps the gap
            line (one visible line, not two); when the user scrolls, the
            gap moves away with the grid and the shadow stays attached to
            the sticky header — drawing the line that anchors it. */}
        <div
          className="bg-paper sticky top-0 z-30"
          style={{ boxShadow: '0 1px 0 var(--c-line-meta)' }}
        />
        <div
          data-perimeter
          className="bg-paper sticky top-0 z-30"
          style={{ boxShadow: '0 1px 0 var(--c-line-meta)' }}
        >
          <Topbar
            path={path}
            onJump={handleJump}
            onReset={handleReset}
            data={data}
            hideBreadcrumb
          />
          {/* Breadcrumb row is always rendered so the header height stays
              constant whether the user is at depth=1 (no crumbs to show)
              or depth>=2. Empty state uses a non-breaking space to reserve
              the line. */}
          <div className="px-4 pb-2 -mt-1 flex items-center justify-center text-meta font-meta">
            {path.length >= 2 ? (
              <Breadcrumb path={path} onJump={handleJump} allInk />
            ) : (
              <span aria-hidden className="invisible">
                &nbsp;
              </span>
            )}
          </div>
        </div>
        <div
          className="bg-paper sticky top-0 z-30"
          style={{ boxShadow: '0 1px 0 var(--c-line-meta)' }}
        />

        {/* Middle row — fractal in middle, empty side margins. */}
        <div className="bg-paper" />
        <div className="bg-paper relative">
          <div
            className="w-full mx-auto"
            style={{
              aspectRatio: '3 / 4',
              maxWidth: 'min(100%, calc(100vh - 220px) * 3 / 4)',
            }}
          >
            <FractalView
              data={data}
              depth={1}
              onCellClick={handleCellClick}
              onInsightClick={undefined}
              zoomIntent={zoomIntent}
              primaryRef={setPrimaryCellRef}
            />
          </div>
          {error && (
            <div className="mt-2 bg-paper border-cell border-ink px-2 py-1 text-meta font-meta">
              {error}
            </div>
          )}
        </div>
        <div className="bg-paper" />

        {/* Bottom row — info pane in middle, empty side margins. */}
        <div className="bg-paper" />
        <div className="bg-paper">
          {focalTerm && (
            <InsightPane term={focalTerm} path={path.slice(0, -1)} />
          )}
        </div>
        <div className="bg-paper" />
      </div>
    );
  }

  // ─── Desktop: a single 3×3 page grid that contains everything — header in
  //     top-middle, content grid in middle-middle, info panel in middle-right.
  //     The right column animates between `clamp × aspect` (panel closed,
  //     mirrors the left column for symmetric viewport-proportional corners)
  //     and the wider INFO_PANEL_OPEN_PX (panel open). The panel content lives
  //     inside the cell and scrolls vertically; the cell clips horizontally
  //     during the animation so the panel "wipes" in/out from the right.
  const desktopRightCol = asideOpen
    ? `${INFO_PANEL_OPEN_PX}px`
    : DESKTOP_CORNER_COL;
  const desktopGridCols = `${DESKTOP_CORNER_COL} 1fr ${desktopRightCol}`;
  return (
    <div
      className="fixed inset-0 bg-line-meta text-ink overflow-hidden grid gap-px"
      style={{
        gridTemplateColumns: desktopGridCols,
        gridTemplateRows: DESKTOP_GRID_ROWS,
        transition: `grid-template-columns ${PANEL_ANIM_MS}ms ${PANEL_ANIM_EASE}`,
      }}
    >
      {/* Top row */}
      <div className="bg-paper" />
      <div data-perimeter className="bg-paper">
        <Topbar
          path={path}
          onJump={handleJump}
          onReset={handleReset}
          data={data}
          hideBreadcrumb={false}
          onToggleAside={toggleAside}
          asideOpen={asideOpen}
          onOpenExport={openExport}
          exportOpen={exportOpen}
        />
      </div>
      <div className="bg-paper" />

      {/* Middle row */}
      <div className="bg-paper" />
      <div className="bg-paper relative">
        <FractalView
          data={data}
          depth={2}
          onCellClick={handleCellClick}
          onInsightClick={handleInsightClick}
          zoomIntent={zoomIntent}
          primaryRef={setPrimaryCellRef}
        />
        {error && (
          <div className="absolute bottom-4 left-8 bg-paper border-cell border-ink px-2 py-1 text-meta font-meta">
            {error}
          </div>
        )}
      </div>
      {/* Info panel cell. The cell itself clips horizontal overflow during
          the column-width animation; the inner div keeps its natural width
          (INFO_PANEL_OPEN_PX) so the panel content doesn't reflow as the cell
          shrinks/grows. We also fade the inner div on the same timing so the
          cell visually empties — without the fade you'd see the left ~86px
          of panel content peeking out of the collapsed corner column.
          Vertical scroll lives on the inner div so longer payloads remain
          reachable when the cell is shorter than the content. When the export
          panel is open, ExportPanel replaces InsightPane in this slot so the
          user can preview the live grid (still visible in the center column)
          while picking format/size/typography/color. */}
      <div className="bg-paper overflow-hidden">
        <div
          className="h-full overflow-y-auto"
          style={{
            width: `${INFO_PANEL_OPEN_PX}px`,
            opacity: asideOpen ? 1 : 0,
            pointerEvents: asideOpen ? 'auto' : 'none',
            transition: `opacity ${PANEL_ANIM_MS}ms ${PANEL_ANIM_EASE}`,
          }}
        >
          {exportOpen ? (
            <ExportPanel
              data={data}
              topic={focalTerm}
              onClose={closeExport}
              withHeader
              withExtraControls
            />
          ) : (
            insightTerm && (
              <InsightPane
                term={insightTerm}
                path={insightContextPath}
                onClose={closeAside}
              />
            )
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="bg-paper" />
      <div className="bg-paper" />
      <div className="bg-paper" />
    </div>
  );
}
