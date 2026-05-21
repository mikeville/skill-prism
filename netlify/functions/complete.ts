// Netlify Function — proxies /api/complete to Anthropic.
// Runs in dev (via `netlify dev`) and in production. The function holds the API key;
// browsers never see it.
//
// The actual cache/log pipeline lives in netlify/lib/handleSearch.ts so the
// same rules apply in `npm run dev` (Vite middleware) and prod (this file).
//
// Uses the Functions v2 (Web Fetch) API so the streaming path can return
// Anthropic's SSE body directly as a ReadableStream. The legacy Handler API
// buffers responses, which silently broke progressive rendering in prod.

import type { Context } from '@netlify/functions';
import type { AnthropicMessage } from '../../src/lib/anthropicPricing';
import {
  extractRequestMeta,
  finalizeBreakdown,
  lookupCache,
  type SearchRequest,
} from '../lib/handleSearch';

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

export default async (req: Request, ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  if (!API_KEY) {
    return jsonResponse(500, {
      error: 'Missing ANTHROPIC_API_KEY on the server. Set it in .env (dev) or Netlify env vars (prod).',
    });
  }

  let body: { prompt?: unknown; path?: unknown; session_id?: unknown; stream?: unknown };
  try {
    body = (await req.json()) as typeof body;
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
  const wantsStream = body.stream === true;

  const headerEntries: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headerEntries[k] = v;
  });
  const meta = extractRequestMeta(headerEntries);
  const searchReq: SearchRequest = { prompt, path, session_id, ...meta };

  try {
    // Cache hits are instant; return them as the normal JSON envelope
    // regardless of `wantsStream`. The client's streamCompletion falls back
    // to the `{ completion }` shape when the response isn't SSE.
    const cache = await lookupCache(searchReq, MODEL);
    if (cache.hit) {
      return jsonResponse(cache.outcome.status, cache.outcome.body);
    }

    if (!wantsStream) {
      const r = await callAnthropic(prompt);
      if (!r.ok) return jsonResponse(r.status, { error: r.text });
      const completion = r.data.content?.[0]?.text ?? '';
      await finalizeBreakdown(searchReq, completion, r.data.usage ?? {}, MODEL);
      return jsonResponse(200, { completion, cache_hit: false });
    }

    // Streaming branch: pipe Anthropic SSE through; tee a second branch into
    // a server-side accumulator that captures text + usage. The post-stream
    // cache write + DB persist runs via ctx.waitUntil so the function survives
    // past the response to finish background work.
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      return jsonResponse(upstream.status, { error: text });
    }

    const [clientBranch, serverBranch] = upstream.body.tee();

    // The public Context type omits waitUntil even though the runtime exposes
    // it for v2 functions. Cast to access it; fall back to fire-and-forget if
    // the runtime doesn't have it (some envs like `netlify dev` may not).
    const bg = accumulateAndFinalize(serverBranch, searchReq, MODEL).catch((e) => {
      console.error('[/api/complete] finalize error', e);
    });
    const waitUntil = (ctx as unknown as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil;
    if (waitUntil) waitUntil(bg);

    return new Response(clientBranch, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
    });
  } catch (e) {
    console.error('[/api/complete] handler error', e);
    return jsonResponse(500, { error: e instanceof Error ? e.message : 'Server error' });
  }
};

async function accumulateAndFinalize(
  stream: ReadableStream<Uint8Array>,
  searchReq: SearchRequest,
  model: string,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let sseBuf = '';
  let captured = '';
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuf += decoder.decode(value, { stream: true });
    let sepIdx = sseBuf.indexOf('\n\n');
    while (sepIdx >= 0) {
      const eventBlock = sseBuf.slice(0, sepIdx);
      sseBuf = sseBuf.slice(sepIdx + 2);
      for (const line of eventBlock.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6)) as {
            type?: string;
            delta?: { type?: string; text?: string };
            message?: { usage?: { input_tokens?: number; output_tokens?: number } };
            usage?: { input_tokens?: number; output_tokens?: number };
          };
          if (
            data.type === 'content_block_delta' &&
            data.delta?.type === 'text_delta' &&
            typeof data.delta.text === 'string'
          ) {
            captured += data.delta.text;
          } else if (data.type === 'message_start' && data.message?.usage) {
            inputTokens = data.message.usage.input_tokens ?? inputTokens;
            outputTokens = data.message.usage.output_tokens ?? outputTokens;
          } else if (data.type === 'message_delta' && data.usage) {
            outputTokens = data.usage.output_tokens ?? outputTokens;
          }
        } catch {
          // Ignore non-JSON SSE lines.
        }
      }
      sepIdx = sseBuf.indexOf('\n\n');
    }
  }

  await finalizeBreakdown(
    searchReq,
    captured,
    { input_tokens: inputTokens, output_tokens: outputTokens },
    model,
  );
}

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

function jsonResponse(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
