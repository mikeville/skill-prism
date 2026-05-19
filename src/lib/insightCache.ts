// LocalStorage-backed cache for /api/insight results. Per-user, per-browser.
// Schema-versioned via the prefix.
//
// Keyed by the TERM alone (normalized), not by (path, term). This mirrors the
// breakdown cache's strategy: revisiting a term from a different drill path
// reuses the same entry. The result is that drilling into a term whose info
// panel is already open is free — no re-fetch — and tokens are spent once per
// distinct term across a user's session.
//
// v2 bumps the schema to drop the old (path, term) keys (different shape).

import type { Insight } from './insightApi';

const PREFIX = 'skill-prism:insight:v5:';

function insightKey(term: string): string {
  return term.toLowerCase().trim();
}

export function insightCacheGet(term: string): Insight | null {
  const key = insightKey(term);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Insight;
    if (
      !parsed ||
      typeof parsed.framing !== 'string' ||
      !Array.isArray(parsed.moves)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function insightCacheSet(term: string, value: Insight): void {
  const key = insightKey(term);
  if (!key) return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — fail silent.
  }
}
