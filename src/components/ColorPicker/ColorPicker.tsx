import { useEffect, useRef, useState } from 'react';

type Vars = {
  ink: string;
  inkMut: string;
  paper: string;
  lineMeta: string;
};

const DEFAULTS: Vars = {
  ink: '#111111',
  inkMut: '#c8c8c8',
  paper: '#ffffff',
  lineMeta: '#5d5d5d',
};

const STORAGE_KEY = 'skill-prism:color-picker';

const PRESETS: { name: string; vars: Vars }[] = [
  { name: 'Default', vars: DEFAULTS },
  { name: 'Inverted', vars: { ink: '#f4f4f4', inkMut: '#5d5d5d', paper: '#111111', lineMeta: '#c8c8c8' } },
  { name: 'Sepia', vars: { ink: '#3a2e1f', inkMut: '#b8a98e', paper: '#f6efe2', lineMeta: '#7a6648' } },
  { name: 'Cool', vars: { ink: '#0e1d2b', inkMut: '#9fb0c4', paper: '#f1f6fb', lineMeta: '#3b556f' } },
  { name: 'Warm', vars: { ink: '#2a1410', inkMut: '#d4b9a8', paper: '#fbf2ed', lineMeta: '#7a4f3d' } },
  { name: 'Mono pop', vars: { ink: '#0a0a0a', inkMut: '#a0a0a0', paper: '#f0f0e8', lineMeta: '#0a0a0a' } },
];

function relLum(hex: string): number {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const la = relLum(a);
  const lb = relLum(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function applyVars(v: Vars) {
  const root = document.documentElement;
  root.style.setProperty('--c-ink', v.ink);
  root.style.setProperty('--c-ink-mut', v.inkMut);
  root.style.setProperty('--c-paper', v.paper);
  root.style.setProperty('--c-line-meta', v.lineMeta);
  // Page background follows paper for a unified surround. Faint ink tracks ink.
  root.style.setProperty('--c-fill-page', v.paper);
  const m = v.ink.replace('#', '');
  const exp = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(exp.slice(0, 2), 16);
  const g = parseInt(exp.slice(2, 4), 16);
  const b = parseInt(exp.slice(4, 6), 16);
  root.style.setProperty('--c-ink-faint', `rgba(${r},${g},${b},0.18)`);
}

export function ColorPicker() {
  const [vars, setVars] = useState<Vars>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULTS;
  });
  const [open, setOpen] = useState(true);
  const [pos, setPos] = useState({ x: 24, y: 24 });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    applyVars(vars);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vars));
    } catch {}
  }, [vars]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };

  const update = (k: keyof Vars, v: string) => setVars((prev) => ({ ...prev, [k]: v }));

  const cInkPaper = contrast(vars.ink, vars.paper);
  const cMutPaper = contrast(vars.inkMut, vars.paper);
  const cInkMut = contrast(vars.ink, vars.inkMut);

  const wcag = (r: number) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA-large' : 'fail');

  return (
    <div
      className="fixed z-50 select-none text-[11px] leading-tight"
      style={{ left: pos.x, top: pos.y, width: open ? 240 : 'auto' }}
    >
      <div
        className="flex items-center justify-between cursor-move px-2 py-1 bg-black text-white"
        onMouseDown={startDrag}
      >
        <span className="font-mono">colors</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="font-mono opacity-70 hover:opacity-100"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {open ? '–' : '+'}
        </button>
      </div>
      {open && (
        <div className="bg-white text-black border border-black border-t-0 p-2 space-y-2 shadow-lg">
          <Row label="primary text" value={vars.ink} onChange={(v) => update('ink', v)} />
          <Row label="secondary text" value={vars.inkMut} onChange={(v) => update('inkMut', v)} />
          <Row label="background" value={vars.paper} onChange={(v) => update('paper', v)} />
          <Row label="grid lines" value={vars.lineMeta} onChange={(v) => update('lineMeta', v)} />

          <div className="border-t border-black/20 pt-2 space-y-0.5 font-mono">
            <div className="flex justify-between">
              <span className="opacity-60">primary / bg</span>
              <span>
                {cInkPaper.toFixed(2)} <em className="opacity-60 not-italic">{wcag(cInkPaper)}</em>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-60">secondary / bg</span>
              <span>
                {cMutPaper.toFixed(2)} <em className="opacity-60 not-italic">{wcag(cMutPaper)}</em>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-60">primary / secondary</span>
              <span>
                {cInkMut.toFixed(2)} <em className="opacity-60 not-italic">{wcag(cInkMut)}</em>
              </span>
            </div>
          </div>

          <div className="border-t border-black/20 pt-2">
            <div className="opacity-60 mb-1 font-mono">presets</div>
            <div className="grid grid-cols-3 gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setVars(p.vars)}
                  className="border border-black/40 hover:border-black px-1 py-0.5 font-mono text-[10px]"
                  title={p.name}
                  style={{ background: p.vars.paper, color: p.vars.ink }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 font-mono">
      <span className="opacity-70">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 p-0 border border-black/30 cursor-pointer bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-[68px] border border-black/20 px-1 text-[10px] uppercase"
        />
      </span>
    </label>
  );
}
