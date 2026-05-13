// POST /api/log-event — fire-and-forget log of a client-side cache hit.
// The client (useBreakdown.ts) calls this via navigator.sendBeacon whenever
// it serves a search from its localStorage cache, so the analytics layer
// doesn't miss repeat-visit drill-downs.

import type { Handler } from '@netlify/functions';
import { extractRequestMeta } from '../lib/handleSearch';
import { handleLogEvent } from '../lib/handleLogEvent';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body: { session_id?: unknown; path?: unknown };
  try {
    body = JSON.parse(event.body ?? '{}') as typeof body;
  } catch {
    return jsonResp(400, { error: 'Invalid JSON body' });
  }
  const session_id = typeof body.session_id === 'string' ? body.session_id : '';
  const path = Array.isArray(body.path)
    ? body.path.map((p) => String(p ?? '')).filter(Boolean)
    : [];

  const meta = extractRequestMeta(event.headers as Record<string, string | undefined>);

  try {
    const outcome = await handleLogEvent({ session_id, path, ...meta }, MODEL);
    return jsonResp(outcome.status, outcome.body);
  } catch (e) {
    console.error('[/api/log-event] error', e);
    return jsonResp(500, { error: e instanceof Error ? e.message : 'Server error' });
  }
};

function jsonResp(statusCode: number, body: object) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
