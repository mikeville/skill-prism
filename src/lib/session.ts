// Per-browser session id. Persisted in localStorage so a returning visitor
// keeps the same id forever — this lets the dashboard group all of one
// person's drill-down activity over time.
//
// Switch to sessionStorage if you ever want per-tab isolation instead.

const KEY = 'skill-prism:session-id:v1';

export function getSessionId(): string {
  let id = '';
  try {
    id = localStorage.getItem(KEY) ?? '';
  } catch {
    // private mode / disabled storage — fall through to a fresh id
  }
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // ignore
    }
  }
  return id;
}
