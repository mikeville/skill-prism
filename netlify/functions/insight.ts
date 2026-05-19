// Netlify Function — proxies /api/insight to Anthropic.
// Thin sibling of complete.ts: takes a prompt, calls Anthropic, returns the
// completion text. No server-side cache or DB logging — client-side localStorage
// is sufficient for the "now what?" payoff, which is keyed per (path, term).

import type { Handler } from '@netlify/functions';

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  if (!API_KEY) {
    return jsonResponse(500, {
      error: 'Missing ANTHROPIC_API_KEY on the server. Set it in .env (dev) or Netlify env vars (prod).',
    });
  }

  let body: { prompt?: unknown };
  try {
    body = JSON.parse(event.body ?? '{}') as typeof body;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return jsonResponse(400, { error: 'Missing prompt' });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: body.prompt }],
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      return jsonResponse(r.status, { error: text });
    }
    const data = (await r.json()) as { content?: Array<{ text?: string }> };
    const completion = data.content?.[0]?.text ?? '';
    return jsonResponse(200, { completion });
  } catch (e) {
    console.error('[/api/insight] handler error', e);
    return jsonResponse(500, { error: e instanceof Error ? e.message : 'Server error' });
  }
};

function jsonResponse(statusCode: number, body: object) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
