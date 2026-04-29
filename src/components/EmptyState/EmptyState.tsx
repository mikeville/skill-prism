import { useEffect, useRef, useState } from 'react';

const EXAMPLES = ['linear algebra', 'the russian revolution', 'espresso extraction'] as const;

type Props = {
  onSubmit: (topic: string) => void;
};

export function EmptyState({ onSubmit }: Props) {
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (v?: string) => {
    const t = (v ?? val).trim();
    if (!t) return;
    onSubmit(t);
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-ink px-4">
      <div className="absolute top-5 left-4 md:top-6 md:left-7 text-meta text-ink-mut">
        Ohtani <span className="text-ink-faint">· fractal topic browser</span>
      </div>
      <div className="absolute top-5 right-4 md:top-6 md:right-7 text-meta text-ink-mut">v0.1</div>

      <div className="w-full max-w-[min(560px,92vw)]">
        <div className="border-y-cell border-ink py-3">
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

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta">
          <span className="text-ink-mut">try:</span>
          {EXAMPLES.map((ex, i) => (
            <span key={ex}>
              <button
                type="button"
                onClick={() => submit(ex)}
                className="underline decoration-ink-faint underline-offset-[3px] text-ink-mut hover:text-ink transition-colors duration-hover"
              >
                {ex}
              </button>
              {i < EXAMPLES.length - 1 && <span className="text-ink-faint mx-1">·</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute bottom-5 left-4 md:bottom-6 md:left-7 text-meta text-ink-mut max-w-[360px] leading-relaxed">
        Each cell decomposes further. Tap to descend.
        <br />
        The path you take shapes what you see next.
      </div>
    </div>
  );
}
