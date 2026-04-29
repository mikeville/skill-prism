import { type ReactNode } from 'react';

export function TweakSection({ label }: { label: string }) {
  return (
    <div className="text-meta text-ink-mut uppercase tracking-wider pt-3 first:pt-0">
      {label}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-meta">
      <span className="text-ink">{label}</span>
      {children}
    </div>
  );
}

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
    <Row label={label}>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative w-9 h-5 border-cell border-ink transition-colors duration-hover ${
          value ? 'bg-gold-primary' : 'bg-paper'
        }`}
      >
        <i
          className={`absolute top-0 left-0 w-4 h-[18px] bg-ink transition-transform duration-hover ${
            value ? 'translate-x-[18px]' : 'translate-x-0'
          }`}
        />
      </button>
    </Row>
  );
}

type RadioOption<T extends string | number> = { value: T; label: string };

export function TweakRadio<T extends string | number>({
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
  return (
    <Row label={label}>
      <div className="flex border-cell border-ink divide-x-cell divide-ink">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => onChange(o.value)}
              className={`px-2 py-1 text-meta transition-colors duration-hover ${
                active ? 'bg-gold-primary text-ink' : 'bg-paper text-ink-mut hover:text-ink'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </Row>
  );
}
