import { useEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './EmptyState.module.css';

const EXAMPLES = ['linear algebra', 'the russian revolution', 'espresso extraction'] as const;

type Props = {
  onSubmit: (topic: string) => void;
  accent: string;
  fontStack: string;
};

export function EmptyState({ onSubmit, accent, fontStack }: Props) {
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
    <div
      className={styles.root}
      style={{ '--accent': accent, fontFamily: fontStack } as CSSProperties}
    >
      <div className={styles.tlLabel}>
        Ohtani <span className={styles.tlSubtle}>· fractal topic browser</span>
      </div>
      <div className={styles.trLabel}>v0.1</div>

      <div className={styles.heading}>breakdown · 9 × 9</div>

      <div className={styles.inputWrap}>
        <input
          ref={inputRef}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="what do you want to learn?"
          className={styles.input}
          style={{ fontFamily: fontStack }}
        />
      </div>

      <div className={styles.examples}>
        <span className={styles.examplesLabel}>try:</span>
        {EXAMPLES.map((ex, i) => (
          <span key={ex}>
            <button
              type="button"
              onClick={() => submit(ex)}
              className={styles.exampleButton}
              style={{ fontFamily: fontStack }}
            >
              {ex}
            </button>
            {i < EXAMPLES.length - 1 && <span className={styles.examplesDot}> · </span>}
          </span>
        ))}
      </div>

      <div className={styles.footnote}>
        Each cell decomposes further. Tap to descend.
        <br />
        The path you take shapes what you see next.
      </div>
    </div>
  );
}
