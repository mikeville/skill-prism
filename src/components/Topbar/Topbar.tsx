import { useEffect, useRef, useState } from 'react';
import { useTypeMode } from '../../contexts/TypeMode';
import { useTypeface } from '../../contexts/Typeface';
import { FONTS, TYPEFACE_KEYS, TYPEFACE_LABELS, type TypefaceKey } from '../../lib/fontConfig';
import { Breadcrumb } from './Breadcrumb';

type Props = {
  path: string[];
  onJump: (idx: number) => void;
  onReset: () => void;
  regenerating: boolean;
  canOpenSkill: boolean;
  skillOpen: boolean;
  onToggleSkill: () => void;
};

export function Topbar({
  path,
  onJump,
  onReset,
  regenerating,
  canOpenSkill,
  skillOpen,
  onToggleSkill,
}: Props) {
  const { mode, toggle } = useTypeMode();
  const { key: typefaceKey, font, set: setTypeface } = useTypeface();
  const display = mode === 'display';

  return (
    <div className="flex items-center gap-6 px-8 h-[62px] bg-fill-page border-b border-line shrink-0">
      <button
        type="button"
        onClick={onReset}
        className="text-secondary font-secondary text-ink hover:opacity-60 transition-opacity duration-hover"
      >
        Ohtani
      </button>
      <Breadcrumb path={path} onJump={onJump} regenerating={regenerating} />
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={display}
          title={display ? 'Switch to plain typography' : 'Switch to display typography'}
          className={[
            'text-secondary text-ink hover:opacity-60 transition-opacity duration-hover',
            'leading-none px-2 py-0.5 border-cell',
            display ? 'border-ink' : 'border-line',
          ].join(' ')}
          style={
            display
              ? {
                  fontFamily: font.family,
                  fontVariationSettings: `"wdth" ${font.aaPreview.wdth}, "wght" ${font.aaPreview.wght}`,
                }
              : undefined
          }
        >
          Aa
        </button>
        <TypefaceDropdown active={typefaceKey} onChange={setTypeface} />
      </div>
      {canOpenSkill && (
        <button
          type="button"
          onClick={onToggleSkill}
          aria-pressed={skillOpen}
          className={[
            'text-secondary font-secondary text-ink hover:opacity-60 transition-opacity duration-hover',
            skillOpen ? 'border-cell border-line px-2 py-0.5' : '',
          ].join(' ')}
        >
          {skillOpen ? 'Skill draft ✕' : 'Skill draft ▸'}
        </button>
      )}
    </div>
  );
}

function TypefaceDropdown({
  active,
  onChange,
}: {
  active: TypefaceKey;
  onChange: (key: TypefaceKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch typeface"
        className={[
          'text-secondary text-ink hover:opacity-60 transition-opacity duration-hover',
          'leading-none px-2 py-0.5 border-cell flex items-center gap-1.5',
          open ? 'border-ink' : 'border-line',
        ].join(' ')}
        style={{
          fontFamily: FONTS[active].family,
          fontVariationSettings: `"wdth" ${FONTS[active].aaPreview.wdth}, "wght" ${FONTS[active].aaPreview.wght}`,
        }}
      >
        <span>{TYPEFACE_LABELS[active]}</span>
        <span aria-hidden className="text-[0.7em] leading-none translate-y-px">▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-1 z-10 min-w-[200px] bg-paper border-cell border-ink py-1"
        >
          {TYPEFACE_KEYS.map((key) => {
            const cfg = FONTS[key];
            const selected = key === active;
            return (
              <li key={key} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={[
                    'w-full text-left text-secondary leading-none px-3 py-2',
                    'hover:bg-fill-page transition-colors duration-hover',
                    selected ? 'text-ink' : 'text-ink',
                  ].join(' ')}
                  style={{
                    fontFamily: cfg.family,
                    fontVariationSettings: `"wdth" ${cfg.aaPreview.wdth}, "wght" ${cfg.aaPreview.wght}`,
                  }}
                >
                  <span className="inline-block w-3 mr-2 align-middle">
                    {selected ? '✓' : ''}
                  </span>
                  {TYPEFACE_LABELS[key]}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
