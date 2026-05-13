// GET /api/admin-sessions?limit=N — most-recent sessions grouped with their events.
// Each event is annotated with token cost (looked up via breakdown_id when cache_hit=false).
import type { Handler } from '@netlify/functions';
import { verifyAdminCookie } from '../lib/auth';
import { supabase } from '../lib/db';

type RawSearch = {
  id: string;
  ts: string;
  session_id: string;
  path: string[];
  cache_hit: boolean;
  depth: number;
  breakdown_id: string;
  country: string | null;
  city: string | null;
};

type RawBreakdown = {
  id: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
};

export const handler: Handler = async (event) => {
  if (!verifyAdminCookie(event.headers.cookie ?? event.headers.Cookie)) {
    return jsonResp(401, { error: 'Unauthorized' });
  }
  if (!supabase) return jsonResp(500, { error: 'Database not configured' });

  const limit = clamp(parseIntOr(event.queryStringParameters?.limit, 30), 1, 100);

  // Find the N most recent sessions. Overfetch then dedupe.
  const { data: recent, error: e1 } = await supabase
    .from('searches')
    .select('session_id, ts')
    .order('ts', { ascending: false })
    .limit(limit * 20);
  if (e1) return jsonResp(500, { error: e1.message });

  const seen = new Set<string>();
  const sessionIds: string[] = [];
  for (const r of (recent ?? []) as { session_id: string }[]) {
    if (seen.has(r.session_id)) continue;
    seen.add(r.session_id);
    sessionIds.push(r.session_id);
    if (sessionIds.length >= limit) break;
  }
  if (sessionIds.length === 0) return jsonResp(200, { sessions: [] });

  const { data: events, error: e2 } = await supabase
    .from('searches')
    .select('id, ts, session_id, path, cache_hit, depth, country, city, breakdown_id')
    .in('session_id', sessionIds)
    .order('ts', { ascending: true });
  if (e2) return jsonResp(500, { error: e2.message });

  const missIds = Array.from(
    new Set((events ?? []).filter((e: RawSearch) => !e.cache_hit).map((e: RawSearch) => e.breakdown_id)),
  );
  let tokenById = new Map<string, RawBreakdown>();
  if (missIds.length > 0) {
    const { data: bs, error: e3 } = await supabase
      .from('breakdowns')
      .select('id, input_tokens, output_tokens, cost_usd')
      .in('id', missIds);
    if (e3) return jsonResp(500, { error: e3.message });
    tokenById = new Map((bs ?? []).map((b: RawBreakdown) => [b.id, b]));
  }

  type SessionOut = {
    session_id: string;
    country: string | null;
    cost_usd: number;
    events: {
      id: string;
      ts: string;
      path: string[];
      cache_hit: boolean;
      depth: number;
      input_tokens: number;
      output_tokens: number;
      cost_usd: number;
    }[];
  };

  const sessionMap = new Map<string, SessionOut>();
  for (const e of (events ?? []) as RawSearch[]) {
    if (!sessionMap.has(e.session_id)) {
      sessionMap.set(e.session_id, {
        session_id: e.session_id,
        country: e.country,
        cost_usd: 0,
        events: [],
      });
    }
    const session = sessionMap.get(e.session_id)!;
    const b = e.cache_hit ? undefined : tokenById.get(e.breakdown_id);
    const cost = b ? Number(b.cost_usd ?? 0) : 0;
    session.events.push({
      id: e.id,
      ts: e.ts,
      path: e.path,
      cache_hit: e.cache_hit,
      depth: e.depth,
      input_tokens: b?.input_tokens ?? 0,
      output_tokens: b?.output_tokens ?? 0,
      cost_usd: cost,
    });
    session.cost_usd += cost;
  }
  const sessions = sessionIds
    .map((id) => sessionMap.get(id))
    .filter((s): s is SessionOut => Boolean(s));

  return jsonResp(200, { sessions });
};

function parseIntOr(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
function jsonResp(statusCode: number, body: object) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
