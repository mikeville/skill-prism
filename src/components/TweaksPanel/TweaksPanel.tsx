import { type ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
};

export function TweaksPanel({ open, onClose, children }: Props) {
  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        className="md:hidden fixed inset-0 bg-ink/30 z-40"
        aria-hidden
      />
      <aside
        className="
          fixed z-50 bg-paper border-cell border-ink flex flex-col
          inset-x-0 bottom-0 max-h-[80vh]
          md:inset-auto md:right-4 md:bottom-4 md:w-72 md:max-h-[calc(100vh-2rem)]
        "
      >
        <header className="flex items-center justify-between border-b-cell border-ink px-4 py-3">
          <span className="text-meta uppercase tracking-wider font-secondary">Tweaks</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-mut hover:text-ink transition-colors duration-hover"
          >
            ✕
          </button>
        </header>
        <div className="flex flex-col gap-3 px-4 py-3 overflow-y-auto">{children}</div>
      </aside>
    </>
  );
}
