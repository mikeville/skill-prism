// Keystroke gate for the Tweaks panel: press '?' anywhere outside an input to toggle.
// Persists open/closed to localStorage so the panel stays put across reloads.

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ohtani:tweaks-open:v1';

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persist(open: boolean) {
  try {
    if (open) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function useTweaksPanelOpen(): [boolean, (next: boolean) => void] {
  const [open, setOpenState] = useState<boolean>(load);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    persist(next);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?') return;
      // Don't fight typing in inputs / textareas / contenteditable
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return;
      }
      e.preventDefault();
      setOpenState((prev) => {
        const next = !prev;
        persist(next);
        return next;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return [open, setOpen];
}
