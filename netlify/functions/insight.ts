// Netlify Function — proxies /api/insight to Anthropic.
// Thin sibling of complete.ts: takes a prompt, calls Anthropic, returns the
// completion text. No server-side cache or DB logging — client-side localStorage
// is sufficient for the "now what?" payoff, which is keyed per (path, term).
//
// Uses the Functions v2 (Web Fetch) API so the streaming path can return
// Anthropic's SSE body directly as a ReadableStream. The legacy Handler API
// buffers responses, which silently broke progressive rendering in prod.

import type { Context } from '@netlify/functions';

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  if (!API_KEY) {
    return jsonResponse(500, {
      error: 'Missing ANTHROPIC_API_KEY on the server. Set it in .env (dev) or Netlify env vars (prod).',
    });
  }

  let body: { prompt?: unknown; stream?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return jsonResponse(400, { error: 'Missing prompt' });
  }
  const wantsStream = body.stream === true;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
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
        ...(wantsStream ? { stream: true } : {}),
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return jsonResponse(upstream.status, { error: text });
    }

    if (wantsStream && upstream.body) {
      // Pipe Anthropic's SSE body straight through. The client parser keys on
      // `content_block_delta` + `text_delta` events, which Anthropic emits
      // natively — no re-shaping needed.
      return new Response(upstream.body, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
        },
      });
    }

    const data = (await upstream.json()) as { content?: Array<{ text?: string }> };
    const completion = data.content?.[0]?.text ?? '';
    return jsonResponse(200, { completion });
  } catch (e) {
    console.error('[/api/insight] handler error', e);
    return jsonResponse(500, { error: e instanceof Error ? e.message : 'Server error' });
  }
};

function jsonResponse(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
