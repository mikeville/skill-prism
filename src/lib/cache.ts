// LocalStorage-backed cache for breakdowns. Per-user, per-browser.
// Schema-versioned via the prefix so we can bump on breaking changes.
//
// Keyed by the LAST term in the path (normalized) rather than the full path.
// This means revisiting a topic reuses its breakdown regardless of which parent
// path led there — so e.g. "Burr types" reached from the top-level grid hits
// the same cache entry as "Burr types" reached via "Grind mechanics".

import type { Breakdown } from '../types';

const PREFIX = 'skill-prism:cache:v1:';

export function pathKey(path: string[]): string {
  const last = path[path.length - 1] ?? '';
  return last.toLowerCase().trim();
}

export function cacheGet(path: string[]): Breakdown | null {
  const key = pathKey(path);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Breakdown;
    if (
      !parsed ||
      !Array.isArray(parsed.mains) ||
      parsed.mains.length !== 8 ||
      !Array.isArray(parsed.subs) ||
      parsed.subs.length !== 8
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function cacheSet(path: string[], value: Breakdown): void {
  const key = pathKey(path);
  if (!key) return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — fail silent.
  }
}

export function cacheClear(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}
