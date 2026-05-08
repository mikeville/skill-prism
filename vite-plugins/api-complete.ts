// Vite middleware that handles /api/complete in dev — same logic as
// netlify/functions/complete.ts, but running inside Vite so dev doesn't need
// `netlify dev` and gets sub-100ms HMR for everything (including the function
// proxy itself, since this file is loaded by Vite).
//
// Production unchanged: /api/complete is served by the Netlify Function.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnv, type Plugin } from 'vite';
import {
  buildUsageEntry,
  formatUsageLine,
  type AnthropicMessage,
} from '../src/lib/anthropicPricing';

export function apiCompleteProxy(): Plugin {
  let apiKey = '';
  let model = 'claude-haiku-4-5-20251001';

  return {
    name: 'api-complete-dev-proxy',
    apply: 'serve', // dev only — production uses the Netlify Function
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '');
      apiKey = env.ANTHROPIC_API_KEY ?? '';
      model = env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
    },
    configureServer(server) {
      server.middlewares.use('/api/complete', async (req, res) => {
        if (req.method !== 'POST') {
          return jsonResponse(res, 405, { error: 'Method not allowed' });
        }
        if (!apiKey) {
          return jsonResponse(res, 500, {
            error: 'Missing ANTHROPIC_API_KEY in .env',
          });
        }

        let body: { prompt?: unknown };
        try {
          body = JSON.parse(await readBody(req)) as { prompt?: unknown };
        } catch {
          return jsonResponse(res, 400, { error: 'Invalid JSON body' });
        }
        if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
          return jsonResponse(res, 400, { error: 'Missing prompt' });
        }
        const prompt = body.prompt;

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
              max_tokens: 4096,
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          if (!r.ok) {
            const text = await r.text();
            return jsonResponse(res, r.status, { error: text });
          }
          const data = (await r.json()) as AnthropicMessage;
          const completion = data.content?.[0]?.text ?? '';
          logUsage(prompt, data, model);
          return jsonResponse(res, 200, { completion });
        } catch (e) {
          console.error('[api/complete] error', e);
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

function logUsage(prompt: string, data: AnthropicMessage, model: string) {
  const entry = buildUsageEntry(prompt, data, model);
  console.log(formatUsageLine(entry));
  appendFile(join(process.cwd(), 'usage.jsonl'), JSON.stringify(entry) + '\n').catch((e) =>
    console.error('usage log write failed:', e),
  );
}
