import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { EmptyState, type FirstRect } from './components/EmptyState/EmptyState';
import { FractalView } from './components/FractalView/FractalView';
import type { CellClick } from './components/FractalView/Level';
import type { ZoomIntent } from './components/FractalView/FractalView';
import { Topbar } from './components/Topbar/Topbar';
import { ColorThemeProvider } from './contexts/ColorTheme';
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
  const { data, regenerating, error } = useBreakdown(path);
  const { ref: gridContainerRef, depth } = useContainerDepth();
  useViewportAspect();
  const zoomIntent = useRef<ZoomIntent | null>(null);
  const prevPathLengthRef = useRef(0);

  // FLIP source rect: the empty-state input wrapper's bounding box at submit
  // time. Captured synchronously inside EmptyState's submit handler before
  // setPath runs so the wrapper is still mounted.
  const morphFirstRectRef = useRef<FirstRect | null>(null);
  // FLIP target ref: the depth=2 primary cell (desktop) or depth=1 standalone
  // outer frame (mobile). Set by Cell/Level via callback ref on mount.
  const primaryCellRef = useRef<HTMLDivElement | null>(null);
  const setPrimaryCellRef = (el: HTMLDivElement | null) => {
    primaryCellRef.current = el;
  };

  const inEmpty = path.length === 0;

  const handleSubmit = (topic: string, firstRect: FirstRect | null) => {
    morphFirstRectRef.current = firstRect;
    zoomIntent.current = null;
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

  return (
    <div className="fixed inset-0 bg-fill-page text-ink overflow-hidden">
      {inEmpty && <EmptyState onSubmit={handleSubmit} />}
      {!inEmpty && (
        <div ref={gridContainerRef} className="absolute inset-0 flex flex-col">
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
          <div data-perimeter>
            <Topbar
              path={path}
              onJump={handleJump}
              onReset={handleReset}
              regenerating={regenerating}
              data={data}
            />
          </div>
          <div className="relative flex-1 min-h-0">
            <FractalView
              data={data}
              depth={depth}
              onCellClick={handleCellClick}
              zoomIntent={zoomIntent}
              primaryRef={setPrimaryCellRef}
            />
            {error && (
              <div className="absolute bottom-4 left-8 bg-paper border-cell border-ink px-2 py-1 text-meta font-meta">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
