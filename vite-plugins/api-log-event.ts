// Vite middleware mirror of /api/log-event for `npm run dev`.
// In production this is served by netlify/functions/log-event.ts; this file
// makes it work without needing `netlify dev`.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';
import { extractRequestMeta } from '../netlify/lib/handleSearch';
import { handleLogEvent } from '../netlify/lib/handleLogEvent';

export function apiLogEventProxy(): Plugin {
  let model = 'claude-haiku-4-5-20251001';

  return {
    name: 'api-log-event-dev-proxy',
    apply: 'serve',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '');
      for (const k of [
        'ANTHROPIC_MODEL',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_KEY',
        'CACHE_TTL_DAYS',
      ]) {
        if (env[k] && !process.env[k]) process.env[k] = env[k];
      }
      model = process.env.ANTHROPIC_MODEL || env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
    },
    configureServer(server) {
      server.middlewares.use('/api/log-event', async (req, res) => {
        if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });

        let body: { session_id?: unknown; path?: unknown };
        try {
          body = JSON.parse(await readBody(req)) as typeof body;
        } catch {
          return jsonResponse(res, 400, { error: 'Invalid JSON body' });
        }
        const session_id = typeof body.session_id === 'string' ? body.session_id : '';
        const path = Array.isArray(body.path)
          ? body.path.map((p) => String(p ?? '')).filter(Boolean)
          : [];

        const meta = extractRequestMeta(req.headers);

        try {
          const outcome = await handleLogEvent({ session_id, path, ...meta }, model);
          return jsonResponse(res, outcome.status, outcome.body);
        } catch (e) {
          console.error('[/api/log-event] error', e);
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
    req.on('data', (c: Buffer) => (buf += c.toString()));
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

function jsonResponse(res: ServerResponse, statusCode: number, body: object) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}
