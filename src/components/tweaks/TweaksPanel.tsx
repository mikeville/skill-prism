// Floating Tweaks panel — draggable, dismissable, viewport-clamped.
// The postMessage host protocol from the prototype is gone; open/close is owned
// by the parent (App) and toggled via the keystroke gate in useTweaksPanelOpen.

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import styles from './TweaksPanel.module.css';

const PAD = 16;

type Props = {
  title?: string;
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
};

export function TweaksPanel({ title = 'Tweaks', open, onClose, children }: Props) {
  const dragRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: PAD, y: PAD });

  const clampToViewport = useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = `${offsetRef.current.x}px`;
    panel.style.bottom = `${offsetRef.current.y}px`;
  }, []);

  useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  const onDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev: MouseEvent) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) return null;
  return (
    <div
      ref={dragRef}
      className={styles.panel}
      style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}
    >
      <div className={styles.header} onMouseDown={onDragStart}>
        <b>{title}</b>
        <button
          type="button"
          className={styles.closeBtn}
          aria-label="Close tweaks"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
