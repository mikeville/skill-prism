// Netlify Function — proxies /api/complete to Anthropic.
// Runs in dev (via `netlify dev`) and in production. The function holds the API key;
// browsers never see it.
//
// The actual cache/log pipeline lives in netlify/lib/handleSearch.ts so the
// same rules apply in `npm run dev` (Vite middleware) and prod (this file).

import type { Handler } from '@netlify/functions';
import type { AnthropicMessage } from '../../src/lib/anthropicPricing';
import { extractRequestMeta, handleSearch } from '../lib/handleSearch';

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  if (!API_KEY) {
    return jsonResponse(500, {
      error: 'Missing ANTHROPIC_API_KEY on the server. Set it in .env (dev) or Netlify env vars (prod).',
    });
  }

  let body: { prompt?: unknown; path?: unknown; session_id?: unknown };
  try {
    body = JSON.parse(event.body ?? '{}') as typeof body;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return jsonResponse(400, { error: 'Missing prompt' });
  }
  const prompt = body.prompt;
  const path = Array.isArray(body.path) ? body.path.map((p) => String(p ?? '')).filter(Boolean) : [];
  const session_id =
    typeof body.session_id === 'string' && body.session_id ? body.session_id : crypto.randomUUID();

  const meta = extractRequestMeta(event.headers as Record<string, string | undefined>);

  try {
    const outcome = await handleSearch(
      { prompt, path, session_id, ...meta },
      callAnthropic,
      MODEL,
    );
    return jsonResponse(outcome.status, outcome.body);
  } catch (e) {
    console.error('[/api/complete] handler error', e);
    return jsonResponse(500, { error: e instanceof Error ? e.message : 'Server error' });
  }
};

async function callAnthropic(
  prompt: string,
): Promise<{ ok: true; data: AnthropicMessage } | { ok: false; status: number; text: string }> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) return { ok: false, status: r.status, text: await r.text() };
  return { ok: true, data: (await r.json()) as AnthropicMessage };
}

function jsonResponse(statusCode: number, body: object) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
