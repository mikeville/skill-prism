import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useInsight } from '../../hooks/useInsight';
import { InsightContent } from './InsightContent';

type Props = {
  open: boolean;
  onClose: () => void;
  path: string[];
  term: string | null;
};

const ANIM_MS = 240;

export function InsightDrawer({ open, onClose, path, term }: Props) {
  // We always render while open OR mid-close so the slide-out can play. The
  // useInsight call is gated on `open` so a closed drawer doesn't fetch.
  const [retryKey, setRetryKey] = useState(0);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Small delay so the initial transform/opacity styles paint before we
      // flip to "visible" — otherwise React batches both renders into one
      // commit and the CSS transition gets skipped on first open.
      const t = window.setTimeout(() => setVisible(true), 16);
      return () => window.clearTimeout(t);
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), ANIM_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  // Reset retry counter when the target term changes.
  useEffect(() => {
    setRetryKey(0);
  }, [term]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const { insight, loading, error } = useInsight(
    open && term ? path : null,
    open ? term : null,
  );

  if (!mounted || !term) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 pointer-events-none"
      role="dialog"
      aria-modal="false"
      aria-label="Insight"
    >
      {/* Click-outside catcher. Non-tinted (no overlay) so the fractal grid
          stays visible beside the drawer. */}
      <div
        className="absolute inset-0 pointer-events-auto"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="absolute top-0 right-0 h-full w-[min(420px,92vw)] bg-paper border-l border-line-meta pointer-events-auto flex flex-col overflow-hidden"
        style={{
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          opacity: visible ? 1 : 0,
          transition: `transform ${ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          boxShadow: '-12px 0 48px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end px-6 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="text-meta font-meta text-ink-mut hover:opacity-60 transition-opacity duration-hover focus-ring"
            aria-label="Close insight"
          >
            CLOSE
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <InsightContent
            key={retryKey}
            term={term}
            insight={insight}
            loading={loading}
            error={error}
            onRetry={() => setRetryKey((k) => k + 1)}
          />
        </div>
      </aside>
    </div>,
    document.body,
  );
}
