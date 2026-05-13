// Fire-and-forget log of a localStorage cache hit. Lets the server-side
// analytics layer record repeat-visit drill-downs that the client served
// from its own cache without ever calling /api/complete.
//
// Uses navigator.sendBeacon when available so the request survives page
// unload (e.g. user clicks a cell, the log fires, they navigate away).
// Falls back to fetch with keepalive: true for the same reason.

import { getSessionId } from './session';

export function logCacheHit(path: string[]): void {
  if (!path || path.length === 0) return;

  let payload: string;
  try {
    payload = JSON.stringify({ session_id: getSessionId(), path });
  } catch {
    return; // pathological input — silently skip
  }

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      // sendBeacon picks Content-Type from the Blob, so JSON-bodied beacons work.
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon('/api/log-event', blob)) return;
    } catch {
      // fall through to fetch
    }
  }

  try {
    void fetch('/api/log-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore — logging must never throw
  }
}
