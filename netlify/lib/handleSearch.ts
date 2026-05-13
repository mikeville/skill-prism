// The search pipeline: cache lookup → Anthropic call → DB write.
// Shared between netlify/functions/complete.ts (prod + `netlify dev`) and
// vite-plugins/api-complete.ts (`npm run dev`), so the rules and counters
// match in both environments.

import {
  buildUsageEntry,
  formatUsageLine,
  type AnthropicMessage,
} from '../../src/lib/anthropicPricing';
import {
  type Breakdown,
  dbEnabled,
  getCachedBreakdown,
  insertBreakdown,
  insertSearch,
} from './db';

const DEFAULT_TTL_DAYS = 30;

function resolveTtlDays(): number {
  const raw = process.env.CACHE_TTL_DAYS;
  if (raw === undefined) return DEFAULT_TTL_DAYS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TTL_DAYS;
}

export type SearchRequest = {
  prompt: string;
  path: string[];
  session_id: string;
  ip: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  referrer: string | null;
};

export type CallAnthropic = (prompt: string) => Promise<
  | { ok: true; data: AnthropicMessage }
  | { ok: false; status: number; text: string }
>;

export type SearchOutcome =
  | { status: 200; body: { completion: string; cache_hit: boolean } }
  | { status: number; body: { error: string } };

function parseBreakdown(raw: string): Breakdown | null {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);

  let parsed: { mains?: unknown; subs?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.mains) || !Array.isArray(parsed.subs)) return null;

  const mains: string[] = (parsed.mains as unknown[]).slice(0, 8).map((x) => String(x ?? ''));
  while (mains.length < 8) mains.push('');
  const subs: string[][] = [];
  for (let i = 0; i < 8; i++) {
    const rawRow = (parsed.subs as unknown[])[i];
    const row: string[] = Array.isArray(rawRow)
      ? (rawRow as unknown[]).slice(0, 8).map((x) => String(x ?? ''))
      : [];
    while (row.length < 8) row.push('');
    subs.push(row);
  }
  return { mains, subs };
}

export async function handleSearch(
  req: SearchRequest,
  callAnthropic: CallAnthropic,
  model: string,
): Promise<SearchOutcome> {
  const ttlDays = resolveTtlDays();

  // 1. Server-side cache lookup.
  if (req.path.length > 0) {
    const cached = await getCachedBreakdown(model, req.path, ttlDays);
    if (cached) {
      await insertSearch({
        session_id: req.session_id,
        path: req.path,
        breakdown_id: cached.id,
        cache_hit: true,
        ip: req.ip,
        country: req.country,
        city: req.city,
        user_agent: req.user_agent,
        referrer: req.referrer,
      });
      console.log(`[cache hit] ${req.path.join(' › ')}`);
      return {
        status: 200,
        body: {
          completion: JSON.stringify(cached.result),
          cache_hit: true,
        },
      };
    }
  }

  // 2. Cache miss → call Anthropic.
  const r = await callAnthropic(req.prompt);
  if (!r.ok) {
    return { status: r.status, body: { error: r.text } };
  }
  const completion = r.data.content?.[0]?.text ?? '';

  // 3. Existing console-log usage line (kept for Netlify-log redundancy).
  const entry = buildUsageEntry(req.prompt, r.data, model);
  console.log(formatUsageLine(entry));
  console.log(JSON.stringify(entry));

  // 4. Best-effort persistence. DB failures must not break the user.
  if (dbEnabled && req.path.length > 0) {
    const parsed = parseBreakdown(completion);
    if (parsed) {
      const id = await insertBreakdown({
        model,
        path: req.path,
        result: parsed,
        input_tokens: entry.input_tokens,
        output_tokens: entry.output_tokens,
        cost_usd: entry.estimated_cost_usd ?? 0,
      });
      if (id) {
        await insertSearch({
          session_id: req.session_id,
          path: req.path,
          breakdown_id: id,
          cache_hit: false,
          ip: req.ip,
          country: req.country,
          city: req.city,
          user_agent: req.user_agent,
          referrer: req.referrer,
        });
      }
    } else {
      console.warn('[handleSearch] could not parse breakdown for cache; skipping persistence');
    }
  }

  return {
    status: 200,
    body: { completion, cache_hit: false },
  };
}

// Pulls request-meta fields from either Netlify-function event headers or raw
// node IncomingMessage headers. Returns nulls if not present.
export function extractRequestMeta(headers: Record<string, string | string[] | undefined>): {
  ip: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  referrer: string | null;
} {
  const h = (name: string): string | null => {
    const v = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(v)) return v[0] ?? null;
    return typeof v === 'string' ? v : null;
  };
  // Netlify sets `x-nf-client-connection-ip` and `x-country`. The geo JSON
  // header is `x-nf-geo` (base64 in some configs, JSON in others). We try
  // best-effort extraction without throwing.
  let city: string | null = null;
  let country: string | null = h('x-country') ?? null;
  const geoRaw = h('x-nf-geo');
  if (geoRaw) {
    try {
      const decoded = /^[A-Za-z0-9+/=]+$/.test(geoRaw)
        ? Buffer.from(geoRaw, 'base64').toString('utf8')
        : geoRaw;
      const j = JSON.parse(decoded) as { city?: string; country?: { code?: string; name?: string } };
      if (j.city) city = j.city;
      if (!country && j.country?.code) country = j.country.code;
    } catch {
      /* ignore geo parse failures */
    }
  }
  return {
    ip: h('x-nf-client-connection-ip') ?? h('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    country,
    city,
    user_agent: h('user-agent'),
    referrer: h('referer') ?? h('referrer'),
  };
}
