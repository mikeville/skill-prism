// GET /api/admin-stats?range=day|week|month|all — aggregate counters + sparkline data.
// Aggregation is done in-process (no SQL aggregate views) so the schema stays simple
// and the analytics surface evolves freely.
import type { Handler } from '@netlify/functions';
import { verifyAdminCookie } from '../lib/auth';
import { supabase } from '../lib/db';

const RANGES = { day: 1, week: 7, month: 30 } as const;
type Range = keyof typeof RANGES | 'all';

type RawSearch = {
  ts: string;
  session_id: string;
  path: string[];
  cache_hit: boolean;
  country: string | null;
  breakdown_id: string;
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

  const range = (event.queryStringParameters?.range ?? 'all') as Range;
  const days = range === 'all' ? null : RANGES[range as keyof typeof RANGES];
  const sinceIso = days == null ? null : new Date(Date.now() - days * 86_400_000).toISOString();

  let q = supabase
    .from('searches')
    .select('ts, session_id, path, cache_hit, country, breakdown_id', { count: 'exact' })
    .order('ts', { ascending: true });
  if (sinceIso) q = q.gte('ts', sinceIso);
  // Cap result set to a sane upper bound. For higher volume, swap in a SQL view.
  const { data: searches, count, error } = await q.limit(10_000);
  if (error) return jsonResp(500, { error: error.message });

  const all = (searches ?? []) as RawSearch[];
  const missIds = Array.from(
    new Set(all.filter((s) => !s.cache_hit).map((s) => s.breakdown_id)),
  );
  let tokenById = new Map<string, RawBreakdown>();
  if (missIds.length > 0) {
    const { data: bs, error: e2 } = await supabase
      .from('breakdowns')
      .select('id, input_tokens, output_tokens, cost_usd')
      .in('id', missIds);
    if (e2) return jsonResp(500, { error: e2.message });
    tokenById = new Map((bs ?? []).map((b: RawBreakdown) => [b.id, b]));
  }

  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;
  let hits = 0;
  let misses = 0;
  const byDay: Record<string, { searches: number; cost: number }> = {};
  const byCountry: Record<string, number> = {};
  const byQuery: Record<string, number> = {};
  const sessionSet = new Set<string>();

  for (const s of all) {
    sessionSet.add(s.session_id);
    const day = (s.ts || '').slice(0, 10);
    const bucket = byDay[day] || { searches: 0, cost: 0 };
    bucket.searches += 1;
    const country = s.country || 'Unknown';
    byCountry[country] = (byCountry[country] || 0) + 1;
    const root = (s.path?.[0] || '').toLowerCase().trim();
    if (root) byQuery[root] = (byQuery[root] || 0) + 1;
    if (s.cache_hit) {
      hits += 1;
    } else {
      misses += 1;
      const b = tokenById.get(s.breakdown_id);
      if (b) {
        totalIn += b.input_tokens || 0;
        totalOut += b.output_tokens || 0;
        const c = Number(b.cost_usd ?? 0);
        totalCost += c;
        bucket.cost += c;
      }
    }
    byDay[day] = bucket;
  }

  const topQueries = Object.entries(byQuery)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, n]) => ({ query, count: n }));

  const countries = Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1])
    .map(([country, n]) => ({ country, count: n }));

  const daily = Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({ day, searches: v.searches, cost: Number(v.cost.toFixed(6)) }));

  return jsonResp(200, {
    range,
    totals: {
      events: count ?? all.length,
      sessions: sessionSet.size,
      cache_hits: hits,
      cache_misses: misses,
      cache_hit_rate: all.length ? hits / all.length : 0,
      input_tokens: totalIn,
      output_tokens: totalOut,
      cost_usd: Number(totalCost.toFixed(6)),
    },
    daily,
    countries,
    top_queries: topQueries,
  });
};

function jsonResp(statusCode: number, body: object) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
