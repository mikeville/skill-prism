// GET /api/admin-events?limit=N&offset=N — paginated search log with joined breakdown info.
import type { Handler } from '@netlify/functions';
import { verifyAdminCookie } from '../lib/auth';
import { supabase } from '../lib/db';

export const handler: Handler = async (event) => {
  if (!verifyAdminCookie(event.headers.cookie ?? event.headers.Cookie)) {
    return jsonResp(401, { error: 'Unauthorized' });
  }
  if (!supabase) return jsonResp(500, { error: 'Database not configured' });

  const limit = clamp(parseIntOr(event.queryStringParameters?.limit, 50), 1, 200);
  const offset = clamp(parseIntOr(event.queryStringParameters?.offset, 0), 0, 100_000);

  const { data: searches, count, error: e1 } = await supabase
    .from('searches')
    .select('*', { count: 'exact' })
    .order('ts', { ascending: false })
    .range(offset, offset + limit - 1);
  if (e1) return jsonResp(500, { error: e1.message });

  const breakdownIds = Array.from(
    new Set((searches ?? []).map((s) => s.breakdown_id).filter(Boolean)),
  );
  let breakdownById = new Map<string, unknown>();
  if (breakdownIds.length > 0) {
    const { data: bs, error: e2 } = await supabase
      .from('breakdowns')
      .select('id, model, result, input_tokens, output_tokens, cost_usd, created_at')
      .in('id', breakdownIds);
    if (e2) return jsonResp(500, { error: e2.message });
    breakdownById = new Map((bs ?? []).map((b) => [b.id as string, b]));
  }

  const events = (searches ?? []).map((s) => ({
    ...s,
    breakdown: breakdownById.get(s.breakdown_id) ?? null,
  }));

  return jsonResp(200, { events, total: count ?? 0, limit, offset });
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
