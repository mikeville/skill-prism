import { useEffect, useRef, useState } from 'react';
import { selectRandomExamples } from '../../data/examples';
import { useGridDimensions } from '../../hooks/useGridDimensions';

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
    setExamples(selectRandomExamples(3));
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
      <div
        className={`absolute top-5 left-6 md:top-6 md:left-8 text-meta font-meta text-ink transition-opacity duration-200 ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`}
      >
        Skill Prism <span className="text-ink-mut">· fractal topic browser</span>
      </div>
      <div
        className={`absolute top-5 right-6 md:top-6 md:right-8 text-meta font-meta text-ink-mut transition-opacity duration-200 ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`}
      >
        v0.1
      </div>

      {!isAnimatingOut && (
        <div style={{ width: dims.morphTargetWidth }}>
          <div
            ref={wrapperRef}
            className="border border-cell bg-paper p-4 md:p-6"
          >
            <input
              ref={inputRef}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="what do you want to learn?"
              className="w-full bg-transparent border-0 outline-none text-input text-ink"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta font-meta">
            <span className="text-ink-mut">try:</span>
            {examples.map((ex, i) => (
              <span key={ex}>
                <button
                  type="button"
                  onClick={() => submit(ex)}
                  className="underline decoration-ink-mut underline-offset-[3px] text-ink-mut hover:text-ink transition-colors duration-hover"
                >
                  {ex}
                </button>
                {i < examples.length - 1 && <span className="text-ink-mut mx-1">·</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        className={`absolute bottom-5 left-6 md:bottom-6 md:left-8 text-meta font-meta text-ink-mut max-w-[360px] leading-relaxed transition-opacity duration-200 ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`}
      >
        Each cell decomposes further. Tap to descend.
        <br />
        The path you take shapes what you see next.
      </div>
    </div>
  );
}
