import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { DataState } from '../../types';
import { ExportPanel } from './ExportPanel';

type Props = {
  open: boolean;
  onClose: () => void;
  data: DataState | null;
  topic: string;
};

// Mobile-only export surface: portal + scrim + centered card wrapping the
// shared ExportPanel form. On desktop the same panel is rendered inline in
// the info-panel slot — see App.tsx.
export function ExportModal({ open, onClose, data, topic }: Props) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Export"
    >
      <div className="absolute inset-0 bg-paper/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-paper border border-line-meta w-[min(420px,90vw)]"
        style={{ boxShadow: '0 12px 48px rgba(0,0,0,0.35)' }}
      >
        <ExportPanel data={data} topic={topic} onClose={onClose} withHeader withExtraControls={false} />
      </div>
    </div>,
    document.body,
  );
}
