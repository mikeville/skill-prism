import { useEffect, useMemo, useRef, useState } from 'react';
import { useColorTheme } from '../../contexts/ColorTheme';
import { COLOR_SETS } from '../../lib/themes';

const TRANSITION_MS = 160;

export function ColorPicker() {
  const { setId, swapped, setSet, toggleSwap } = useColorTheme();
  const [open, setOpen] = useState(false);
  const { mounted, entered } = useTransitionState(open, TRANSITION_MS);
  const containerRef = useRef<HTMLDivElement>(null);

  const index = useMemo(
    () => Math.max(0, COLOR_SETS.findIndex((s) => s.id === setId)),
    [setId],
  );

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex items-center">
      <CircleTrigger open={open} onToggle={() => setOpen((o) => !o)} />
      {mounted && (
        <Panel
          entered={entered}
          index={index}
          swapped={swapped}
          onIndexChange={(i) => setSet(COLOR_SETS[i].id)}
          onSwap={toggleSwap}
        />
      )}
    </div>
  );
}

/** Mount/entered pattern for entrance + exit transitions without a library. */
function useTransitionState(open: boolean, durationMs: number) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    const t = window.setTimeout(() => setMounted(false), durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs]);

  return { mounted, entered };
}

function CircleTrigger({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="COLOR SET"
      title="COLOR SET"
      className="text-ink-mut hover:opacity-60 transition-opacity duration-hover flex items-center justify-center"
      style={{ width: 24, height: 24, lineHeight: 0 }}
    >
      <CircleIcon />
    </button>
  );
}

type PanelProps = {
  entered: boolean;
  index: number;
  swapped: boolean;
  onIndexChange: (i: number) => void;
  onSwap: () => void;
};

function Panel({ entered, index, swapped, onIndexChange, onSwap }: PanelProps) {
  const max = COLOR_SETS.length - 1;
  const prevIndex = useRef(index);

  function handleSlide(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    if (v === prevIndex.current) return;
    prevIndex.current = v;
    try {
      if ('vibrate' in navigator) navigator.vibrate(6);
    } catch {
      /* unsupported — fine */
    }
    onIndexChange(v);
  }

  return (
    <div
      role="dialog"
      aria-label="Color set picker"
      aria-hidden={!entered}
      className="fixed md:absolute z-50 left-4 right-4 md:left-auto md:right-0 md:w-[280px] top-[calc(clamp(48px,6vmin,72px)+6px)] md:top-[calc(100%+6px)]"
      style={{
        background: 'var(--c-paper)',
        border: '1px solid var(--c-line-meta)',
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(-4px)',
        transition: `opacity ${TRANSITION_MS}ms ease-out, transform ${TRANSITION_MS}ms ease-out`,
        pointerEvents: entered ? 'auto' : 'none',
      }}
    >
      <div className="flex items-center gap-3" style={{ padding: '12px 14px' }}>
        <Slider
          value={index}
          max={max}
          onChange={handleSlide}
          ariaValueText={`SET ${COLOR_SETS[index].id}`}
        />
        <SwapButton swapped={swapped} onSwap={onSwap} />
      </div>
    </div>
  );
}

function Slider({
  value,
  max,
  onChange,
  ariaValueText,
}: {
  value: number;
  max: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  ariaValueText: string;
}) {
  return (
    <div className="relative flex-1">
      <Ticks count={max + 1} />
      <input
        type="range"
        className="color-slider relative"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={onChange}
        aria-label="COLOR SET INDEX"
        aria-valuetext={ariaValueText}
      />
    </div>
  );
}

/** Ticks sit behind the slider track. With a 14px thumb, the thumb's CENTER
 *  travels from 7px to (track width − 7px), so ticks must align to that range. */
function Ticks({ count }: { count: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: `calc(7px + ${i / (count - 1)} * (100% - 14px))`,
            width: 1,
            height: 8,
            marginTop: -4,
            background: 'var(--c-ink-mut)',
          }}
        />
      ))}
    </div>
  );
}

function SwapButton({ swapped, onSwap }: { swapped: boolean; onSwap: () => void }) {
  return (
    <button
      type="button"
      onClick={onSwap}
      aria-label="SWAP PAPER AND INK"
      aria-pressed={swapped}
      title={swapped ? 'RESTORE PAPER/INK' : 'SWAP PAPER AND INK'}
      className="hover:opacity-60 transition-opacity duration-hover shrink-0 flex items-center justify-center"
      style={{
        width: 28,
        height: 28,
        lineHeight: 0,
        color: swapped ? 'var(--c-ink)' : 'var(--c-ink-mut)',
        transition: 'color 120ms ease-out',
      }}
    >
      <SwapIcon />
    </button>
  );
}

/** Simple outline circle. Same stroke weight + viewBox as the download icon
 *  so it reads as part of the same icon family. translateY nudges caps-text
 *  optical center down toward the geometric icon center. */
function CircleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      style={{ transform: 'translateY(-1px)' }}
      aria-hidden
    >
      <circle cx="7" cy="7" r="5.5" />
    </svg>
  );
}

/** Hand-drawn two-row arrows mirroring the download icon's chevron + line
 *  vocabulary. Top row points right; bottom row points left. */
function SwapIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      aria-hidden
    >
      <path d="M1.5 4.5 L12.5 4.5" />
      <path d="M10 2 L12.5 4.5 L10 7" />
      <path d="M12.5 9.5 L1.5 9.5" />
      <path d="M4 7 L1.5 9.5 L4 12" />
    </svg>
  );
}
