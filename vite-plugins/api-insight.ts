// Vite middleware that handles /api/insight in dev — thin proxy to Anthropic.
// Mirrors api-complete.ts but without the cache/log pipeline (insights are
// client-cached in localStorage and don't need server-side persistence yet).
//
// Production unchanged: /api/insight is served by the Netlify Function.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';

export function apiInsightProxy(): Plugin {
  let apiKey = '';
  let model = 'claude-sonnet-4-6';

  return {
    name: 'api-insight-dev-proxy',
    apply: 'serve',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '');
      for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL']) {
        if (env[k] && !process.env[k]) process.env[k] = env[k];
      }
      apiKey = process.env.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
      model = process.env.ANTHROPIC_MODEL || env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    },
    configureServer(server) {
      server.middlewares.use('/api/insight', async (req, res) => {
        if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });
        if (!apiKey) return jsonResponse(res, 500, { error: 'Missing ANTHROPIC_API_KEY in .env' });

        let body: { prompt?: unknown };
        try {
          body = JSON.parse(await readBody(req)) as typeof body;
        } catch {
          return jsonResponse(res, 400, { error: 'Invalid JSON body' });
        }
        if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
          return jsonResponse(res, 400, { error: 'Missing prompt' });
        }

        try {
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model,
              max_tokens: 1024,
              messages: [{ role: 'user', content: body.prompt }],
            }),
          });
          if (!r.ok) {
            const text = await r.text();
            return jsonResponse(res, r.status, { error: text });
          }
          const data = (await r.json()) as { content?: Array<{ text?: string }> };
          const completion = data.content?.[0]?.text ?? '';
          return jsonResponse(res, 200, { completion });
        } catch (e) {
          console.error('[/api/insight] error', e);
          return jsonResponse(res, 500, {
            error: e instanceof Error ? e.message : 'Server error',
          });
        }
      });
    },
  };
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
