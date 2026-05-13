// Vite middleware that handles /api/complete in dev — delegates to the same
// handleSearch pipeline as the Netlify function so cache/log behavior matches.
//
// Production unchanged: /api/complete is served by the Netlify Function.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { loadEnv, type Plugin } from 'vite';
import type { AnthropicMessage } from '../src/lib/anthropicPricing';
import { extractRequestMeta, handleSearch } from '../netlify/lib/handleSearch';

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

        let body: { prompt?: unknown; path?: unknown; session_id?: unknown };
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

        const meta = extractRequestMeta(req.headers);

        try {
          const outcome = await handleSearch(
            { prompt, path, session_id, ...meta },
            (p) => callAnthropic(p, apiKey, model),
            model,
          );
          return jsonResponse(res, outcome.status, outcome.body);
        } catch (e) {
          console.error('[/api/complete] error', e);
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
