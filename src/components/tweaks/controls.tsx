// Form controls for the Tweaks panel: Section, Row, Slider, Radio, Select, Toggle, Color.
// Trimmed from the prototype (Number/Text/Button removed — Ohtani's panel doesn't use them).

import { useRef, useState, type ReactNode } from 'react';
import styles from './TweaksPanel.module.css';

// ── Layout helpers ────────────────────────────────────────────────────────────

export function TweakSection({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <>
      <div className={styles.section}>{label}</div>
      {children}
    </>
  );
}

export function TweakRow({
  label,
  value,
  inline = false,
  children,
}: {
  label: string;
  value?: ReactNode;
  inline?: boolean;
  children?: ReactNode;
}) {
  const className = inline ? `${styles.row} ${styles.rowInline}` : styles.row;
  return (
    <div className={className}>
      <div className={styles.label}>
        <span>{label}</span>
        {value != null && <span className={styles.value}>{value}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Slider ────────────────────────────────────────────────────────────────────

export function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input
        type="range"
        className={styles.slider}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </TweakRow>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

export function TweakToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={`${styles.row} ${styles.rowInline}`}>
      <div className={styles.label}>
        <span>{label}</span>
      </div>
      <button
        type="button"
        className={styles.toggle}
        data-on={value ? '1' : '0'}
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
      >
        <i />
      </button>
    </div>
  );
}

// ── Radio (segmented) ─────────────────────────────────────────────────────────

type RadioOption<T extends string> = T | { value: T; label: string };

export function TweakRadio<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<RadioOption<T>>;
  onChange: (v: T) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const opts = options.map((o) =>
    typeof o === 'object' ? o : ({ value: o, label: o } as { value: T; label: string }),
  );
  const idx = Math.max(
    0,
    opts.findIndex((o) => o.value === value),
  );
  const n = opts.length;

  // Latest active value via ref so pointermove handlers don't stale-closure onChange.
  const valueRef = useRef(value);
  valueRef.current = value;

  const segAt = (clientX: number): T => {
    const r = trackRef.current!.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev: PointerEvent) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <TweakRow label={label}>
      <div
        ref={trackRef}
        role="radiogroup"
        onPointerDown={onPointerDown}
        className={dragging ? `${styles.seg} ${styles.segDragging}` : styles.seg}
      >
        <div
          className={styles.segThumb}
          style={{
            left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
            width: `calc((100% - 4px) / ${n})`,
          }}
        />
        {opts.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={styles.segButton}
          >
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────

type SelectOption<T extends string> = T | { value: T; label: string };

export function TweakSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (v: T) => void;
}) {
  return (
    <TweakRow label={label}>
      <select
        className={styles.field}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </TweakRow>
  );
}

// ── Color ─────────────────────────────────────────────────────────────────────

export function TweakColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={`${styles.row} ${styles.rowInline}`}>
      <div className={styles.label}>
        <span>{label}</span>
      </div>
      <input
        type="color"
        className={styles.swatch}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
