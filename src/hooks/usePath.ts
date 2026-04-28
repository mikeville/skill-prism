// URL-synced path state. Encodes path[] in window.location.hash so URLs are
// shareable and the browser back/forward buttons navigate the breakdown.
//
// Format: #/segment-1/segment-2  (segments URL-encoded)
// Empty path: no hash at all (so the bare URL is clean).

import { useCallback, useEffect, useState } from 'react';

const PREFIX = '#/';

function decodePath(hash: string): string[] {
  if (!hash || hash === '#' || hash === '#/') return [];
  let s = hash.startsWith('#') ? hash.slice(1) : hash;
  if (s.startsWith('/')) s = s.slice(1);
  if (!s) return [];
  return s.split('/').map(decodeURIComponent).filter(Boolean);
}

function encodePath(path: string[]): string {
  if (path.length === 0) return '';
  return PREFIX + path.map(encodeURIComponent).join('/');
}

function pathsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function usePath(): [string[], (next: string[]) => void] {
  const [path, setPathState] = useState<string[]>(() => decodePath(window.location.hash));

  // Keep React state in sync with hash on browser back/forward and external changes.
  useEffect(() => {
    const sync = () => {
      const next = decodePath(window.location.hash);
      setPathState((prev) => (pathsEqual(prev, next) ? prev : next));
    };
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const setPath = useCallback((next: string[]) => {
    const encoded = encodePath(next);
    const currentHash = window.location.hash;

    if (encoded === '') {
      // Clearing the path — strip the hash entirely so we don't leave a bare '#'.
      // history.pushState doesn't fire hashchange, so update state manually.
      if (currentHash) {
        const url = window.location.pathname + window.location.search;
        window.history.pushState(null, '', url);
      }
      setPathState((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    if (encoded !== currentHash) {
      window.location.hash = encoded; // fires hashchange → listener syncs state
    }
    // Optimistic update so consumers see the new path immediately.
    setPathState((prev) => (pathsEqual(prev, next) ? prev : next));
  }, []);

  return [path, setPath];
}
