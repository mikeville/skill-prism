// LocalStorage-backed cache for /api/insight results. Per-user, per-browser.
// Schema-versioned via the prefix. Keyed by (path, term) so the same term
// reached via different drill paths is cached separately — unlike the breakdown
// cache, the path provides meaningful framing context here.

import type { Insight } from './insightApi';

const PREFIX = 'skill-prism:insight:v1:';

function insightKey(path: string[], term: string): string {
  const normPath = path.map((p) => p.toLowerCase().trim()).join('›');
  const normTerm = term.toLowerCase().trim();
  return `${normPath}∷${normTerm}`;
}

export function insightCacheGet(path: string[], term: string): Insight | null {
  const key = insightKey(path, term);
  if (!key || key === '∷') return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Insight;
    if (
      !parsed ||
      typeof parsed.framing !== 'string' ||
      !Array.isArray(parsed.resources) ||
      !Array.isArray(parsed.actions)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function insightCacheSet(path: string[], term: string, value: Insight): void {
  const key = insightKey(path, term);
  if (!key || key === '∷') return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — fail silent.
  }
}
