import { useState } from 'react';
import type { DataState } from '../../types';
import { ExportModal } from './ExportModal';

type Props = {
  data: DataState | null;
  topic: string;
};

export function ExportButton({ data, topic }: Props) {
  const [open, setOpen] = useState(false);
  const disabled = !data || !topic;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title="EXPORT"
        aria-label="Export"
        className="text-meta font-meta text-ink-mut hover:opacity-60 transition-opacity duration-hover focus-ring leading-none disabled:opacity-40 disabled:hover:opacity-40 disabled:cursor-not-allowed flex items-center justify-center h-6"
      >
        {/* Down-arrow into tray glyph — keeps the topbar's text-only minimalism */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          style={{ transform: 'translateY(-1px)' }}
          aria-hidden
        >
          <path d="M7 1.5 V9" />
          <path d="M3.5 6 L7 9.5 L10.5 6" />
          <path d="M2 12 L12 12" />
        </svg>
      </button>
      <ExportModal open={open} onClose={() => setOpen(false)} data={data} topic={topic} />
    </>
  );
}
