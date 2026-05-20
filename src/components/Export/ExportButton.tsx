import { useState } from 'react';
import type { DataState } from '../../types';
import { ExportModal } from './ExportModal';

type Props = {
  data: DataState | null;
  topic: string;
  // Desktop wiring: when provided, the click delegates to the parent (which
  // renders ExportPanel inline in the info-panel slot) instead of opening a
  // modal. `panelOpen` reflects the parent's open state so the icon can show
  // its active treatment.
  onOpenPanel?: () => void;
  panelOpen?: boolean;
};

export function ExportButton({ data, topic, onOpenPanel, panelOpen }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const disabled = !data || !topic;
  const usePanel = !!onOpenPanel;
  const active = usePanel ? !!panelOpen : modalOpen;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (usePanel) onOpenPanel?.();
          else setModalOpen(true);
        }}
        disabled={disabled}
        aria-pressed={active}
        title="EXPORT"
        aria-label="Export"
        className={`text-meta font-meta hover:opacity-60 transition-opacity duration-hover focus-ring leading-none disabled:opacity-40 disabled:hover:opacity-40 disabled:cursor-not-allowed flex items-center justify-center h-6 ${
          active ? 'text-ink' : 'text-ink-mut'
        }`}
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
      {!usePanel && (
        <ExportModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          data={data}
          topic={topic}
        />
      )}
    </>
  );
}
