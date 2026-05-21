// Vite middleware that handles /api/complete in dev — delegates to the same
// handleSearch pipeline as the Netlify function so cache/log behavior matches.
//
// Production unchanged: /api/complete is served by the Netlify Function.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { loadEnv, type Plugin } from 'vite';
import type { AnthropicMessage } from '../src/lib/anthropicPricing';
import {
  extractRequestMeta,
  finalizeBreakdown,
  lookupCache,
  type SearchRequest,
} from '../netlify/lib/handleSearch';

export function apiCompleteProxy(): Plugin {
  let apiKey = '';
  let model = 'claude-haiku-4-5-20251001';

  return {
    name: 'api-complete-dev-proxy',
    apply: 'serve',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '');
      // Surface the Vite-loaded env vars to handleSearch / db.ts, which read
      // process.env directly (they're shared with the Netlify function code).
      for (const k of [
        'ANTHROPIC_API_KEY',
        'ANTHROPIC_MODEL',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_KEY',
        'ADMIN_TOKEN',
        'CACHE_TTL_DAYS',
      ]) {
        if (env[k] && !process.env[k]) process.env[k] = env[k];
      }
      apiKey = process.env.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
      model = process.env.ANTHROPIC_MODEL || env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
    },
    configureServer(server) {
      server.middlewares.use('/api/complete', async (req, res) => {
        if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });
        if (!apiKey) return jsonResponse(res, 500, { error: 'Missing ANTHROPIC_API_KEY in .env' });

        let body: { prompt?: unknown; path?: unknown; session_id?: unknown; stream?: unknown };
        try {
          body = JSON.parse(await readBody(req)) as typeof body;
        } catch {
          return jsonResponse(res, 400, { error: 'Invalid JSON body' });
        }
        if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
          return jsonResponse(res, 400, { error: 'Missing prompt' });
        }
        const prompt = body.prompt;
        const path = Array.isArray(body.path)
          ? body.path.map((p) => String(p ?? '')).filter(Boolean)
          : [];
        const session_id =
          typeof body.session_id === 'string' && body.session_id ? body.session_id : randomUUID();
        const wantsStream = body.stream === true;

        const meta = extractRequestMeta(req.headers);
        const searchReq: SearchRequest = { prompt, path, session_id, ...meta };

        try {
          // Cache hits are instant; return them as the normal JSON envelope
          // regardless of `wantsStream`. The client's streamCompletion falls
          // back to the `{ completion }` shape when the response isn't SSE.
          const cache = await lookupCache(searchReq, model);
          if (cache.hit) {
            return jsonResponse(res, cache.outcome.status, cache.outcome.body);
          }

          if (!wantsStream) {
            const r = await callAnthropic(prompt, apiKey, model);
            if (!r.ok) return jsonResponse(res, r.status, { error: r.text });
            const completion = r.data.content?.[0]?.text ?? '';
            await finalizeBreakdown(searchReq, completion, r.data.usage ?? {}, model);
            return jsonResponse(res, 200, { completion, cache_hit: false });
          }

          // Streaming branch: pipe Anthropic SSE straight through while
          // accumulating the text and usage tokens locally for post-stream
          // cache write + DB persist.
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model,
              max_tokens: 4096,
              messages: [{ role: 'user', content: prompt }],
              stream: true,
            }),
          });
          if (!r.ok) {
            const text = await r.text();
            return jsonResponse(res, r.status, { error: text });
          }

          res.statusCode = 200;
          res.setHeader('content-type', 'text/event-stream');
          res.setHeader('cache-control', 'no-cache');
          res.setHeader('connection', 'keep-alive');

          const reader = r.body?.getReader();
          if (!reader) {
            res.end();
            return;
          }

          const decoder = new TextDecoder();
          let sseBuf = '';
          let captured = '';
          let inputTokens = 0;
          let outputTokens = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);

              // Parse SSE events to capture text + usage without re-reading.
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
                      // message_delta carries cumulative output usage.
                      outputTokens = data.usage.output_tokens ?? outputTokens;
                    }
                  } catch {
                    // Ignore non-JSON SSE lines.
                  }
                }
                sepIdx = sseBuf.indexOf('\n\n');
              }
            }
          } finally {
            res.end();
          }

          // Best-effort: persist to cache + log usage after the response is
          // already sent. Failures here must not affect the user.
          finalizeBreakdown(searchReq, captured, { input_tokens: inputTokens, output_tokens: outputTokens }, model).catch((e) => {
            console.error('[/api/complete] finalize error', e);
          });
          return;
        } catch (e) {
          console.error('[/api/complete] error', e);
          if (res.headersSent) {
            res.end();
            return;
          }
          return jsonResponse(res, 500, {
            error: e instanceof Error ? e.message : 'Server error',
          });
        }
      });
    },
  };
}

async function callAnthropic(
  prompt: string,
  apiKey: string,
  model: string,
): Promise<{ ok: true; data: AnthropicMessage } | { ok: false; status: number; text: string }> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) return { ok: false, status: r.status, text: await r.text() };
  return { ok: true, data: (await r.json()) as AnthropicMessage };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (chunk: Buffer) => (buf += chunk.toString()));
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

function jsonResponse(res: ServerResponse, statusCode: number, body: object) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}
