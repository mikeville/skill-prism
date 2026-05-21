import { Fragment, useEffect, useRef, useState } from 'react';
import { selectRandomExamples } from '../../data/examples';
import { useGridDimensions } from '../../hooks/useGridDimensions';
import { SkillPrismMark } from '../SkillPrismMark';

export type FirstRect = { top: number; left: number; width: number; height: number };

type Props = {
  onSubmit: (topic: string, firstRect: FirstRect | null) => void;
  isAnimatingOut?: boolean;
};

export function EmptyState({ onSubmit, isAnimatingOut = false }: Props) {
  const [val, setVal] = useState('');
  const [examples, setExamples] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dims = useGridDimensions();

  useEffect(() => {
    setExamples(selectRandomExamples(7));
    inputRef.current?.focus();
  }, []);

  const submit = (v?: string) => {
    const t = (v ?? val).trim();
    if (!t) return;
    const r = wrapperRef.current?.getBoundingClientRect();
    const first: FirstRect | null = r
      ? { top: r.top, left: r.left, width: r.width, height: r.height }
      : null;
    onSubmit(t, first);
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-ink px-4">
      {/* Brand mark. Vertically centered inside a virtual topbar-height zone so
          it sits at the exact same y-position as the Topbar SKILL PRISM button
          that replaces it after submit. Animates out to the right; the Topbar
          mark animates in from the left for a jump-cut handoff. The wordmark
          itself is shared with the Topbar via SkillPrismMark so both states
          stay visually identical. */}
      <div
        className={`absolute top-0 left-4 flex items-center text-meta font-meta text-ink transition-[opacity,transform] duration-200 ease-out ${isAnimatingOut ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0'}`}
        style={{ height: 'clamp(48px, 6vmin, 72px)' }}
      >
        <SkillPrismMark withTagline />
      </div>
      {!isAnimatingOut && (
        <div style={{ width: dims.morphTargetWidth }}>
          <div
            ref={wrapperRef}
            className="border border-cell border-line-meta focus-within:border-ink-mut transition-colors duration-hover bg-paper p-4 md:p-6"
          >
            <input
              ref={inputRef}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="WHAT DO YOU WANT TO LEARN?"
              className="w-full bg-transparent border-0 outline-none text-display text-ink"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta font-meta">
            <span className="text-ink-mut">TRY:</span>
            {examples.map((ex, i) => (
              <Fragment key={ex}>
                <button
                  type="button"
                  onClick={() => submit(ex)}
                  className="underline decoration-ink-mut underline-offset-[3px] text-ink-mut hover:text-ink transition-colors duration-hover focus-ring leading-4"
                >
                  {ex}
                </button>
                {i < examples.length - 1 && (
                  <span className="text-ink-mut" aria-hidden="true">·</span>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Bottom-left intro-copy slot. Intentionally empty for now. To reintroduce,
          add a <div> here with the same positioning + transition pattern used
          by the top-left brand mark above (absolute bottom-5 left-6 md:bottom-6
          md:left-8, text-meta font-meta text-ink-mut, fade-out via isAnimatingOut). */}
    </div>
  );
}
