// Logs a localStorage-cache-hit search event without invoking Anthropic or
// looking at the prompt. Used by /api/log-event, which the client calls
// fire-and-forget when it serves a search from its own client-side cache.
//
// Behavior:
//   - Looks up an existing breakdown row by (current model, full path).
//   - If found, inserts a searches row with cache_hit=true.
//   - If no breakdown row exists for this (model, path), returns logged=false
//     — this happens for legacy localStorage entries created before the DB
//     existed, or for paths cached under an older model identifier.

import { isDbEnabled, findBreakdown, insertSearch } from './db';

export type LogEventRequest = {
  session_id: string;
  path: string[];
  ip: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  referrer: string | null;
};

export type LogEventOutcome =
  | { status: 200; body: { logged: boolean } }
  | { status: number; body: { error: string } };

export async function handleLogEvent(
  req: LogEventRequest,
  model: string,
): Promise<LogEventOutcome> {
  if (!isDbEnabled()) return { status: 200, body: { logged: false } };
  if (!req.session_id) return { status: 400, body: { error: 'Missing session_id' } };
  if (req.path.length === 0) return { status: 400, body: { error: 'Missing path' } };

  const breakdown = await findBreakdown(model, req.path);
  if (!breakdown) return { status: 200, body: { logged: false } };

  await insertSearch({
    session_id: req.session_id,
    path: req.path,
    breakdown_id: breakdown.id,
    cache_hit: true,
    ip: req.ip,
    country: req.country,
    city: req.city,
    user_agent: req.user_agent,
    referrer: req.referrer,
  });

  return { status: 200, body: { logged: true } };
}
