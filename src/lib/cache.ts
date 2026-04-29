// LocalStorage-backed cache for breakdowns. Per-user, per-browser.
// Schema-versioned via the prefix so we can bump on breaking changes.

import type { Breakdown } from '../types';

const PREFIX = 'ohtani:cache:v2:';

export function pathKey(path: string[]): string {
  return JSON.stringify(path);
}

export function cacheGet(path: string[]): Breakdown | null {
  try {
    const raw = localStorage.getItem(PREFIX + pathKey(path));
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
  try {
    localStorage.setItem(PREFIX + pathKey(path), JSON.stringify(value));
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
